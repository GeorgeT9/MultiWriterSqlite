import { parentPort, workerData } from "node:worker_threads"
import { PartConnect } from "../database/partConnect"
import { FileInfo } from "../files/dirReader"
import { handlersGroup } from "../handlersGroupInit"
import { WorkerNotification } from "./dispatcher"



// данные для инициализации воркера
export interface WorkerData {
    partId: number,
    watchDir: string,
    fullFilePathDb: string
    sqlInit: string
}

const { 
    partId, 
    watchDir,
    sqlInit,
    fullFilePathDb
} = workerData as WorkerData


const partConn = new PartConnect(partId, fullFilePathDb, true,  sqlInit)

// обработка файлов
parentPort?.on("message", function(msg: FileInfo | null) {
    if (msg === null) {
        // данных для обработки больше нет
        partConn.close(true)
            .finally(() => parentPort?.postMessage({
                status: "closed",
                partId
            } satisfies WorkerNotification))
    } else {
        partConn.processFile(watchDir, msg, handlersGroup)
            .then(() => {
                parentPort?.postMessage({
                    status: "success",
                    fileInfo: msg,
                    partId
                } satisfies WorkerNotification)
            })
            .catch(err => {
                parentPort?.postMessage({
                    status: "failed",
                    errorMessage: (err as Error).message,
                    partId,
                    fileInfo: msg
                } satisfies WorkerNotification)
            })
    }
})

// при закрытии канала воркера выполняется закрытие соединения 
parentPort?.on("close", function() {
    partConn.close(true)
})


