import { EventEmitter } from "node:stream";
import { FileInfo } from "../files/dirReader";



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

export type WorkerNotification = SuccessWorkerNotification | FailedWorkerNotification | ClosedConnectNotification



class Dispatcher extends EventEmitter {

    private readonly _watchDir: string
    private readonly _storeDir: string
    private readonly _sqlInitFilePath: string

    constructor(watchDir: string, storeDir: string, sqlInitFilePath: string) {
        super()
        this._watchDir = watchDir
        this._storeDir = storeDir
        this._sqlInitFilePath = sqlInitFilePath
    }


}