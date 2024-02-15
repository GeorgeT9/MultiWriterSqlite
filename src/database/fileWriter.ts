import { Writable } from "stream";
import { getSqliteWriter } from "./sqlite/sqliteBlockWriter"


/**
 * функция для создания writable stream под каждый вновь поступаемый файл
 */
export type FactoryFileWriter = (fileName: string) => Promise<Writable>


export const enum StoreType {
    Sqlite = 'Sqlite'
}


export function getFactoryFileWriter(type: StoreType): FactoryFileWriter {
    switch (type) {
        case StoreType.Sqlite:
            return getSqliteWriter
    
        default:
            throw new Error('Для данного типа хранилища данных writer не определен!')
    }
}
