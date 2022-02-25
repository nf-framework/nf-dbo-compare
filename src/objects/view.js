import { readFile } from 'fs/promises';

import { dirJoin } from './util.js';
import { Dbo } from '../dbo.js';

/**
 * @typedef {Object} ViewDboType
 * @property {string} schema - схема
 * @property {string} name - имя
 * @property {string} body - тело запроса
 * @property {string} description - описание
 */

class DboView extends Dbo {
    /**
     * Сравнение и получение скрипта изменения от одной версии объекта к другой
     * @param {ViewDboType} newObj
     * @param {ViewDboType} oldObj
     * @returns {{safedrop: Array<string>, main: Array<string>}}
     */
    static diff(newObj, oldObj) {
        let res = {safedrop: [], main: []};
        if (oldObj && oldObj.schema && oldObj.name) res.safedrop.push(`drop view if exists ${oldObj.schema}.${oldObj.name};`);
        res.main.push(`create or replace view ${newObj.schema}.${newObj.name} as ${newObj.body}`);
        if (newObj.description) res.main.push(`comment on ${newObj.schema}.${newObj.name} is '${newObj.description}';`);
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

DboView._getSql = await readFile(dirJoin(import.meta.url,'../sql/view-get.sql'),'utf8');

export { DboView };
