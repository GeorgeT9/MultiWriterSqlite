import { EventEmitter } from "node:stream";
import { FileInfo } from "../files/dirReader";


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




class Dispatcher {

    private readonly _storeDir: string
    private readonly _sqlInit: string

    constructor(watchDir: string, storeDir: string, sqlInit: string) {
        this._storeDir = storeDir
        this._sqlInit = sqlInit
    }

    


}