import { parentPort, workerData } from "node:worker_threads"
import { PartConnect } from "../database/partConnect"
import { FileInfo } from "../files/dirReader"
import { handlersGroup } from "../handlersGroupInit"
import { WorkerNotification } from "./dispatcher"



// данные для инициализации воркера
export interface IWorkerData {
    partId: number,
    watchDir: string,
    fullFilePathDb: string
    sqlInitFilePath: string
}

const { 
    partId, 
    watchDir,
    sqlInitFilePath,
    fullFilePathDb
} = workerData as IWorkerData


const partConn = new PartConnect(partId, fullFilePathDb, sqlInitFilePath)

// обработка файлов
parentPort?.on("message", function(fileInfo: FileInfo) {
    partConn.processFile(watchDir, fileInfo, handlersGroup)
        .then(() => {
            parentPort?.postMessage({
                status: "success",
                fileInfo,
                partId
            } satisfies WorkerNotification)
        })
        .catch(err => {
            parentPort?.postMessage({
                status: "failed",
                errorMessage: (err as Error).message,
                partId,
                fileInfo
            } satisfies WorkerNotification)
        })
})

// при канала воркера выполняется закрытие соединения 
parentPort?.on("close", function() {
    partConn.close(true)
})


