import { readFile } from 'fs/promises';

import { dirJoin } from './util.js';
import { Dbo } from '../dbo.js';

/**
 * @typedef {Object} TriggerDboType
 * @property {string} name - наименование триггера
 * @property {string} tablename - наименование таблицы, для которой триггер
 * @property {string} schema - схема таблицы
 * @property {number} num_args - количество аргументов, передаваемых в функцию выполнения
 * @property {Array<string>} args - значения аргументов, передаваемых в функцию выполнения
 * @property {string} function_name - наименование выполняемой функции
 * @property {string} function_schema - схема выполняемой функции
 * @property {string} description - комментарий
 * @property {string} def - полный текст dll триггера (заполняется только при доставании из бд)
 * @property {string} act_scope - объем срабатывания
 * @property {string} act_timing - момент срабатывания
 * @property {boolean} on_insert - срабатывает при добавлении
 * @property {boolean} on_delete - срабатывает при удалении
 * @property {boolean} on_update - срабатывает при исправлении
 * @property {boolean} on_truncate - срабатывает при полной очистке таблицы
 * @property {'n'|'y'|'ydi'|'ydd'} constr - признак триггера-ограничения
*/

class DboTrigger extends Dbo {

    /**
     * Получение данных об объекте бд из подключенной базы данных
     * @param {Client} connect - соединение с базой данных
     * @param {Object} options - параметры выполнения
     * @param {string} options.schema - схема искомого объекта
     * @param {string} options.name - имя
     * @param {string} options.tablename - имя таблицы, которой принадлежит триггер
     * @returns {Promise<FunctionDboType>}
     */
    static async get(connect, options) {
        const { schema, name, tablename } = options;
        const resQuery = await connect.query({ text: this._getSql, values: [schema, name, tablename] });
        return resQuery && resQuery.rows && resQuery.rows[0];
    }

    /**
     * Формирование скрипта создания триггера по подробному описателю
     * @param {TriggerDboType} trig - описатель триггера
     * @returns {string}
     */
    static createScript(trig) {
        let script = `create${(trig.constr === 'n') ? '' : ' constraint'} trigger ${trig.name} ${trig.act_timing}`;
        const events = [
            trig.on_insert ? 'insert' : '',
            trig.on_update ? 'update' : '',
            trig.on_delete ? 'delete' : '',
            trig.on_truncate ? 'truncate' : ''
        ].filter(s => s !== '').join(' or ');
        script += ` ${events} on ${trig.schema}.${trig.tablename}`;
        if (trig.constr === 'ydi' || trig.constr === 'ydd') {
            script += `${(trig.constr === 'ydi') ? ' deferrable' : ' deferrable initially deferred'}`;
        }
        script += ` for each ${trig.act_scope}`;
        if (trig.when) script += ` when (${trig.when})`;
        script += ` execute procedure ${trig.function_schema}.${trig.function_name}(`;
        script += ');';
        return script;
        /*
        CREATE [ CONSTRAINT ] TRIGGER имя { BEFORE | AFTER | INSTEAD OF } { событие [ OR ... ] }
        ON имя_таблицы
        [ FROM ссылающаяся_таблица ]
        [ NOT DEFERRABLE | [ DEFERRABLE ] [ INITIALLY IMMEDIATE | INITIALLY DEFERRED ] ]
        [ FOR [ EACH ] { ROW | STATEMENT } ]
        [ WHEN ( условие ) ]
        EXECUTE PROCEDURE имя_функции ( аргументы )
        */
    }

    /**
     * Сравнение и получение скрипта изменения от одной версии объекта к другой
     * @param {TriggerDboType} newObj
     * @param {TriggerDboType} oldObj
     * @returns {{safedrop: Array<string>, main: Array<string>}}
     */
    static diff(newObj, oldObj) {
        let dropOldText = '';
        if (oldObj && oldObj.name && oldObj.schema && oldObj.tablename) {
            dropOldText = `drop trigger if exists ${oldObj.name} on ${oldObj.schema}.${oldObj.tablename};`;
        }
        const newText = DboTrigger.createScript(newObj);
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

DboTrigger._getSql = await readFile(dirJoin(import.meta.url,'../sql/trigger-get.sql'),'utf8');

export { DboTrigger };








