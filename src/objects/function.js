import { readFile } from 'fs/promises';

import { dirJoin } from './util.js';
import { Dbo } from '../dbo.js';

const ARG_TYPES = {
    i: 'in',
    o: 'out',
    b: 'inout',
    v: 'variadic'
}

/**
 * @typedef {Object} FunctionArgumentDboType
 * @property {string} name - имя
 * @property {string} type - тип данных
 * @property {boolean} typeIsArray - признак, тип данных есть массив из type
 * @property {'in'|'out'|'inout'|'variadic'} mode - режим аргумента (входной,выходной,оба,вариадик)
 * @property {string} default - значение по-умолчанию
 */

/**
 * @typedef {Object} FunctionResTableColumnDboType
 * @property {string} name - имя
 * @property {string} type - тип данных
 * @property {boolean} typeIsArray - признак, тип данных есть массив из type
 */

/**
 * @typedef {Object} FunctionDboType
 * @property {string} schema - схема
 * @property {string} name - имя
 * @property {string} description - описание
 * @property {string} lang - язык
 * @property {string} body - тело функции
 * @property {Array<FunctionArgumentDboType>} args - аргументы функции
 * @property {string} resType - тип возвращаемых данных, заполняется при resKind in ('single'|'set')
 * @property {boolean} resTypeIsArray - признак, что тип возвращаемых данных есть массив из resType
 * @property {'single'|'set'|'void'|'table'|'trigger'} resKind - формат возвращаемых данных 'Одно значение','Набор','Ничего','Таблица','Триггер'
 * @property {Array<FunctionResTableColumnDboType>} resTypeTable - описание возвращаемых данных, когда resKind = 'table'
 * @property {boolean} strict - признак вернуть null при любом входном параметре null
 * @property {boolean} secdef - признак выполнения кода от имени создателя функции(true) или от текущего пользователя(false)
 * @property {'volatile'|'stable'|'immutable'} volatile - запоминание результатов при использовании функции в запросе
 * @property {'unsafe'|'restricted'|'safe'} parallel - пометка для параллельности функции
 * @property {number} cost - ожидаемая стоимость выполнения
 * @property {number} rows - ожидаемое количество возращаемых строк
 * @property {boolean} leakproof - признак, что функция защищенная от утечки памяти
 */

class DboFunction extends Dbo {

    /**
     * Получение данных об объекте бд из подключенной базы данных
     * @param {Client} connect - соединение с базой данных
     * @param {Object} options - параметры выполнения
     * @param {string} options.schema - схема искомого объекта
     * @param {string} options.name - имя
     * @returns {Promise<FunctionDboType>}
     */
    static async get(connect, options) {
        const { schema, name } = options;
        const resQuery = await connect.query({ text: this._getSql, values: [schema, name] });
        /** @type FunctionDboType */
        let res = resQuery && resQuery.rows && resQuery.rows[0];
        res.resKind = 'single';
        if (res.retset) res.resKind = 'set';
        if (res.resType === 'void') res.resKind = 'void';
        if (res.resType === 'trigger') res.resKind = 'trigger';
        const { argnames, argmodes, argdefaults, argtypes } = res;
        // хранение аргументов функций специфичное и требует преобразования для удобства работы далее
        // описание можно посмотреть https://postgrespro.ru/docs/postgrespro/11/catalog-pg-proc
        // TODO разделить строку со значениями по-умолчанию по регулярке
        const aDefaults = (argdefaults) ? argdefaults.split(',') : [];
        res.args = [];
        if (argnames && argnames.length > 0) {
            argnames.forEach((aName, aIndex) => {
                const _defIndex = aIndex - (argnames.length - aDefaults.length);
                /** @type FunctionArgumentDboType */
                const arg = {
                    name: aName,
                    mode: ARG_TYPES[(argmodes && Array.isArray(argmodes)) ? argmodes[aIndex] : 'i'],
                    type: argtypes[aIndex].name,
                    typeIsArray: argtypes[aIndex].isArray,
                    default: (_defIndex >= 0 && _defIndex in aDefaults) ? aDefaults[_defIndex] : null,
                };
                res.args.push(arg);
            });
        }
        delete res.retset, res.argnames, res.argmodes, res.argdefaults, res.argtypes, res.numagrsdefaults;
        return res;
    }

    /**
     * Формирование скрипта создания функции по подробному описателю
     * @param {FunctionDboType} fnc - описатель функции
     * @returns {string}
     */
    static createScript(fnc) {
        const params = fnc.args
            .map(a => `${a.mode} ${a.name} ${a.type}${(a.typeIsArray) ? '[]' : ''}${(a.default) ? ` = ${a.default}` : ''}`)
            .join(',');
        let script = `create or replace function ${fnc.schema}.${fnc.name}(${params || ''}) returns `;
        // возвращаемое значение
        switch (fnc.resKind) {
            case 'single': {
                script += `${fnc.resType}${(fnc.resTypeIsArray) ? '[]' : ''}`;
                break;
            }
            case 'set': {
                script += `setof ${fnc.resType}${(fnc.resTypeIsArray) ? '[]' : ''}`;
                break;
            }
            case 'table': {
                script += fnc.resTypeTable.map(col => `${col.name} ${col.type}${(col.typeIsArray) ? '[]' : ''}`).join(',');
                break;
            }
            default: {
                script += fnc.resKind;
            }
        }
        script += ` as\r\n$body$${fnc.body}$body$\r\n`;
        script += `language ${fnc.lang} security ${(fnc.secdef) ? 'definer' : 'invoker'} ${(fnc.strict) ? 'returns null' : 'called'} on null input`;
        script += ` ${fnc.volatile} parallel ${fnc.parallel}${(fnc.leakproof) ? ' leakproof' : ''}`
        if (fnc.cost > 0) script += ` cost ${fnc.cost}`;
        if (fnc.rows > 0) script += ` rows ${fnc.rows}`;
        script += ';';
        return script;
    }

    /**
     * Сравнение и получение скрипта изменения от одной версии объекта к другой
     * @param {FunctionDboType} newObj
     * @param {FunctionDboType} oldObj
     * @returns {{safedrop: Array<string>, main: Array<string>}}
     */
    static diff(newObj, oldObj) {
        let dropOldText;
        if (oldObj.name) {
            let needDropOld = false;
            // если не совпадают названия
            if (newObj.schema !== oldObj.schema || newObj.name !== oldObj.name) needDropOld = true;
            // если изменился тип возвращаемого значения
            if (!needDropOld && (newObj.resKind !== oldObj.resKind ||
                newObj.resType !== oldObj.resType ||
                newObj.resTypeIsArray !== oldObj.resTypeIsArray)) needDropOld = true;
            // если не совпадают определяющие параметры функции добавим удаление старой
            if (!needDropOld) {
                let sameArgs = ((oldObj.args || []).length === (newObj.args || []).length);
                if (sameArgs) {
                    oldObj.args.forEach((oArg, i) => {
                        const nArg = newObj.args[i] || {};
                        if (oArg.name !== nArg.name ||
                            oArg.type !== nArg.type ||
                            oArg.typeIsArray !== nArg.typeIsArray ||
                            oArg.mode !== nArg.mode) {
                            sameArgs = false;
                        }
                    });
                }
                needDropOld = !sameArgs;
            }
            if (needDropOld) {
                const __args = (oldObj.args || [])
                    .map(m => `${m.mode} ${m.type + (m.typeIsArray ? '[]' : '')}`)
                    .join(',');
                dropOldText = `drop function if exists ${oldObj.schema}.${oldObj.name}(${(__args) || ''});`;
            }
        }
        const newText = DboFunction.createScript(newObj);
        return {
            safedrop: (dropOldText) ? [dropOldText] : [],
            main: [newText]
        };
    }

    /**
     * Объединение детального результата изменения в один скрипт
     * @param {{safedrop: Array<string>, main: Array<string>}} diffRes - результат сравнения
     * @returns {string}
     */
    static diffToScript(diffRes) {
        return [...diffRes.safedrop, ...diffRes.main].join('\r\n');
    }
}

DboFunction._getSql = await readFile(dirJoin(import.meta.url,'../sql/function-get.sql'),'utf8');

export { DboFunction };
