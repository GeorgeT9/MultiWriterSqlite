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
                        conn.pragma('foreign_keys=1')
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
                            conn.pragma('foreign_keys=1')
                            const sqlInstructions = readFileSync(
                                resolve(this._storeDir, this.INITIAL_PART_DB_SQL_FILE),
                                { encoding: 'utf8' }
                            )
                            conn.exec(sqlInstructions)
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
        const partsSize = await this._connMaster<FileDb>('files')
            .select('partId', 'sizeKb')
            .sum('sizeKb', { as: 'sizeKb' })
            .groupBy('partId')
            .orderBy('sizeKb', 'asc')
        return partsSize
    }

    /** Регистрирует новую запись для partDb и возвращает его id */
    private async newPart(): Promise<number> {
        const res = await this._connMaster<PartDb>('parts')
            .insert({ created: new Date() }, 'id')
        return res[0]['id']
    }

    /** Создаст индекс над значениями items */
    private async makeIndexPartDb(connectPartDb: Knex) {
        return new Promise((resolve, reject) => {
            connectPartDb.schema.raw("CREATE INDEX IF NOT EXISTS idx_items ON items(value)")
                .then(resolve)
                .catch(err => reject(err))
        })
    }

    /** Закрывает все соединения, выполняет индексацию */
    async closeAllConnect(vacuum: boolean = false) {
        console.log('Выполнение построения индексов...')
        console.time('index')
        const partsConnections = [...this._connPartMap.values()]
        await Promise.all(partsConnections.map(conn => this.makeIndexPartDb(conn))) 
        console.timeEnd('index')
        if (vacuum) {
            console.log('Выполнение vacuum ...')
            console.time('vacuum')
            Promise.all([
                this._connMaster.fromRaw('VACUUM'),
                ...partsConnections.map(conn => conn.fromRaw('VACUUM'))
            ])
            console.timeEnd('vacuum')
        }
        console.log('Закрытие соединений...')
        await Promise.all(
            [
                this._connMaster.destroy(),
                ...partsConnections.map(conn => conn.destroy)        
            ]
        )
        console.log('Соединения закрыты')
    }

}




