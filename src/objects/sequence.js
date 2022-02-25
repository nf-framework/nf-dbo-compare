import { readFile } from 'fs/promises';

import { dirJoin } from './util.js';
import { Dbo } from '../dbo.js';

/**
 * @typedef {Object} SequenceDboType
 * @property {string} schema - схема
 * @property {string} name - имя
 * @property {number} increment - на сколько увеличивается значение
 * @property {number} minvalue - минимальное значение
 * @property {number} maxvalue - максимальное значение
 * @property {number} start - значение, с которого начнется отсчет
 * @property {boolean} cycle - признак, что после исчерпания значений начнется выдача с начала
 * @property {number} cache - сколько значений генерировать впрок за один вызов
 */

class DboSequence extends Dbo {
    /**
     * Формирование скрипта создания последовательности по подробному описателю
     * @param {SequenceDboType} seq - описатель последовательности
     * @returns {string}
     */
    static createScript(seq) {
        return `create sequence if not exists ${seq.schema}.${seq.name} increment ${seq.increment} minvalue ${seq.minvalue} start ${seq.start} cache ${seq.cache}${(seq.cycle) ? ' cycle' : ''};`;
    }

    /**
     * Сравнение и получение скрипта изменнеия от одной версии объекта к другой
     * @param {SequenceDboType} newObj
     * @param {SequenceDboType} oldObj
     * @returns {{safedrop: Array<string>, main: Array<string>}}
     */
    static diff(newObj, oldObj) {
        const res = { safedrop: [], main: [] };
        if (oldObj && oldObj.name) {
            if (oldObj.schema !== newObj.schema) res.main.push(`alter sequence if exists ${oldObj.schema}.${oldObj.name} set schema ${newObj.schema};`);
            if (oldObj.name !== newObj.name) res.main.push(`alter sequence if exists ${newObj.schema}.${oldObj.name} rename to ${newObj.name};`);
            const changes = [];
            if (oldObj.minvalue !== newObj.minvalue) changes.push(`minvalue ${newObj.minvalue}`);
            if (oldObj.maxvalue !== newObj.maxvalue) changes.push(`maxvalue ${newObj.maxvalue}`);
            if (oldObj.start !== newObj.start) changes.push(`start ${newObj.start}`);
            if (oldObj.increment !== newObj.increment) changes.push(`increment ${newObj.increment}`);
            if (oldObj.cache !== newObj.cache) changes.push(`cache ${newObj.cache}`);
            if (oldObj.cycle !== newObj.cycle) changes.push(`${(newObj.cycle) ? 'cycle' : 'no cycle'}`);
            if (changes.length > 0) res.main.push(`alter sequence if exists ${newObj.schema}.${newObj.name} ${changes.join(' ')};`);
        } else {
            res.main.push(DboSequence.createScript(newObj));
        }
        return res;
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

DboSequence._getSql = await readFile(dirJoin(import.meta.url, '../sql/sequence-get.sql'), 'utf8');

export { DboSequence };
