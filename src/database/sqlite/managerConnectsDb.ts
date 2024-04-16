import { FileDb } from "./schema"
import { resolve } from "node:path"
import { Knex, knex } from "knex"
import { Database } from "better-sqlite3"
import { readFileSync } from "node:fs"
import { PartDb } from "./schema"
import fs from "node:fs/promises"


/**
 * Предоставляет соединения с базами данных sqlite,
 * организацию партирования и индексации
 */
export class ManagerConnectsDb {

    private readonly _storeDir: string                          // директория нахождения баз данных
    private readonly _limitPartKb: number                       // лимит для размера partDb
    private readonly _connMaster: Knex                          // соединенение с мастер базой
    private readonly _connPartMap: Map<number, Knex>            // мапа соединений с part базами, которые используются в данный момент
    private readonly MASTER_DB_NAME = 'master.db'               // имя мастер базы данных
    private readonly PART_DB_PREFIX_NAME = 'part'               // префикс имени баз данных part
    private readonly INITIAL_PART_DB_SQL_FILE = 'part.sql'      // имя файла с инструкциями для создания part db

    constructor(storeDir: string, limitPartKb: number) {
        this._storeDir = storeDir
        this._limitPartKb = limitPartKb
        this._connMaster = this.getConnectionMaster()
        this._connPartMap = new Map()
    }

    /** Генерация имени файла partDb  */
    makeNamePartDb(partId: number) {
        return `${this.PART_DB_PREFIX_NAME}_${partId}.db`
    }

    // применить настроечные прагмы к подключению
    private applyPragmas(conn: Database) {
        const pragmas = [
            "pragma foreign_keys = 1;",
            "pragma synchronous = 0;",
            "pragma journal_mode = WAL;",
            "pragma cache_size = -10000;",
            "pragma locking_mode = EXCLUSIVE;"
        ]
        for (const pragma of pragmas) {
            const res = conn.pragma(pragma)
            console.log('pragma ' + pragma + ' return: ' + res)
        }
        return conn
    }

    /** создание подключения к мастер базе */
    getConnectionMaster() {
        return knex({
            client: 'better-sqlite3',
            connection: {
                filename: resolve(this._storeDir, this.MASTER_DB_NAME),
            },
            pool: {
                afterCreate: (conn: Database, done: (err: Error | null, conn: Database) => void) => {
                    try {
                        this.applyPragmas(conn)
                        done(null, conn)
                    } catch (err) {
                        console.error('Ошибка при подключении к master db: ', (err as Error).message)
                        done(err as Error, conn)
                    }
                }
            },
            useNullAsDefault: true,
            acquireConnectionTimeout: 5000
        })
    }
    
    /** Получить (при необходимость создать новое) подключение к partDb. Вернет номер подключения и само подслючение */
    async getPartConnect() {
        const idPart = await this.getPartId()
        if (!this._connPartMap.has(idPart)) {
            const conn = knex({
                client: 'better-sqlite3',
                connection: {
                    filename: resolve(this._storeDir, this.makeNamePartDb(idPart)),
                },
                useNullAsDefault: true,
                pool: {
                    afterCreate: (conn: Database, done: (err: Error | null, conn: Database) => void) => {
                        try {
                            const sqlInstructions = readFileSync(
                                resolve(__dirname, this.INITIAL_PART_DB_SQL_FILE),
                                { encoding: 'utf8' }
                            )
                            conn.exec(sqlInstructions)
                            this.applyPragmas(conn)
                            conn.exec('DROP INDEX IF EXISTS idx_items')
                            done(null, conn)
                        } catch (err) {
                            console.error('Ошибка при подключении к part db: ', (err as Error).message)
                            done(err as Error, conn)
                        }
                    }
                }
            })
            this._connPartMap.set(idPart, conn)
        }
        return [idPart, this._connPartMap.get(idPart)!] as const
    }

    /** Вернет соединение с partDb по его id;
     *  если файла partDb не существует, то выбрасит ошибку  
    */
    async getPartConnectionById(partId: number) {
        const partName = this.makeNamePartDb(partId)
        try {
            await fs.access(resolve(this._storeDir, partName), fs.constants.W_OK)
        } catch (err) {
            throw new Error(`Файла partDb ${this.makeNamePartDb(partId)} не существует`)
        }
        if (!this._connPartMap.has(partId)) {
            const conn = knex({
                client: 'better-sqlite3',
                connection: {
                    filename: resolve(this._storeDir, partName)
                },
                pool: {
                    afterCreate: (conn: Database, done: (err: Error | null, conn: Database) => void) => {
                        try {
                            this.applyPragmas(conn)
                            done(null, conn)
                        } catch (err) {
                            console.error('Ошибка при подключении к part db: ', (err as Error).message)
                            done(err as Error, conn)
                        }
                    }
                },
                useNullAsDefault: true,
            }) 
            this._connPartMap.set(partId, conn)
        }
        return this._connPartMap.get(partId)!
    }

    /** Вернет id partDb для записи */
    private async getPartId() {
        const partsSize = await this.getPartsSize()
        // выбираем только partId, которые удоветворяют лимиту по размеру
        const partsForUsing = partsSize
            .filter(part => part.sizeKb < this._limitPartKb)
        if (partsForUsing.length > 0) {
            return partsForUsing[0]['partId']
        } else {
            return await this.newPart()
        }
    }

    /** Вернет размеры данных, записанные в каждой part базе, отсортированные от меньшего к большему*/
    private async getPartsSize() {
        const partsSize = await this._connMaster<PartDb>('parts')
            .leftJoin('files', 'parts.id', 'files.partId')
            .groupBy('parts.id')
            .orderBy('sizeKb', 'asc')           
            .select(this._connMaster.raw('parts.id as partId, coalesce(sum(files.sizeKb), 0) as sizeKb'))
        return partsSize
    }

    /** Регистрирует новую запись для partDb и возвращает его id */
    private async newPart(): Promise<number> {
        const res = await this._connMaster<PartDb>('parts')
            .insert({ created: new Date() }, 'id')
        return res[0]['id']
    }

    /** Создаст индекс над значениями items */
    private async makeIndexItemsPartDb(connectPartDb: Knex) {
        return new Promise((resolve, reject) => {
            connectPartDb.schema.raw("CREATE INDEX IF NOT EXISTS idx_items ON items(value)")
                .then(resolve)
                .catch(err => reject(err))
        })
    }

    /** Закрывает все соединения, выполняет индексацию */
    async closeAllConnect() {
        const partsConnections = [...this._connPartMap.values()]
        await Promise.all(partsConnections.map(conn => this.makeIndexItemsPartDb(conn))) 
    }

}




