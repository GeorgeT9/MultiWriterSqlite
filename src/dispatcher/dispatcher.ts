import { readdir } from "node:fs/promises"
import { FileInfo } from "../files/dirReader";
import path from "node:path";
import { PartConnect } from "../database/partConnect";


/** Тип уведомлений от воркера */
export type WorkerNotification = SuccessWorkerNotification | FailedWorkerNotification | ClosedConnectNotification

interface SuccessWorkerNotification {
    status: "success",
    partId: number,
    fileInfo: FileInfo
}

interface FailedWorkerNotification {
    status: "failed",
    errorMessage: string,
    partId: number,
    fileInfo: FileInfo
}

interface ClosedConnectNotification {
    status: "closed",
    partId: number
}


type PartId = number



class Dispatcher {

    private readonly _storeDir: string
    private readonly _sqlInit: string
    private _sizeMap: Map<PartId, number> | null = null

    constructor(watchDir: string, storeDir: string, sqlInit: string) {
        this._storeDir = storeDir
        this._sqlInit = sqlInit
    }

    /** Запрос размера файлов в каждой существующей partDb и вывод их в виде Map<partId, sizeKb> */
    private async updateExistsPartsSize() {
        const partIndexs = await this.getExistsPartsId();
        const connects = await Promise.all(
            [...partIndexs.values()]
                .map(id => new PartConnect(id, this._storeDir, ""))
        )
        const sizes = await Promise.all(
            connects.map(conn => conn.getFilesSizeKb())
        ) 
        const sizeMap = connects
            .map((conn, i) => [conn.partId, sizes[i]] as const)
            .reduce((acc, cur) => acc.set(cur[0], cur[1]), new Map<number, number>)
        await Promise.all(connects.map(conn => conn.close(false)))
        this._sizeMap = sizeMap
    }

    private async getExistsPartsId() {
        const dirEntris = await readdir(this._storeDir)
        return dirEntris
            .filter(entry => entry.match(/\bpart_\d+\.db\b/))
            .map(el => parseInt(el, 10))
            .reduce((acc, cur) => acc.add(cur), new Set<number>)
    }

    /** полный путь к файлу по его partId */
    private async getPathNamePartDb(partId: PartId) {
        return path.resolve(this._storeDir, `part_${partId}.db`)
    }




}