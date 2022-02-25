import modulePg from 'pg';

const { Client } = modulePg;

class Dbo {
    /**
     * Получение данных об объекте бд из подключенной базы данных
     * @param {Client} connect - соединение с базой данных
     * @param {Object} options - параметры выполнения
     * @param {string} options.schema - схема искомого объекта
     * @param {string} options.name - имя
     * @returns {Promise<*>}
     */
    static async get(connect, options) {
        const { schema, name } = options;
        const resQuery = await connect.query({ text: this._getSql, values: [schema, name] });
        return resQuery && resQuery.rows && resQuery.rows[0];
    }
}

export { Dbo };
