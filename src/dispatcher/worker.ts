import { parentPort, workerData } from "node:worker_threads"
import { PartConnect } from "../database/partConnect"
import { FileInfo } from "../files/dirReader"
import { handlersGroup } from "../handlersGroupInit"
import { WorkerNotification } from "./dispatcher"



// данные для инициализации воркера
export interface WorkerData {
    partId: number,
    watchDir: string,
    storeDir: string
    sqlInit: string
}

const { 
    partId, 
    watchDir,
    sqlInit,
    storeDir
} = workerData as WorkerData


const partConn = new PartConnect(partId, storeDir, sqlInit)
parentPort?.postMessage({
    status: "init",
    partId
} satisfies WorkerNotification)

// обработка файлов
parentPort?.on("message", function(msg: FileInfo | null) {
    if (msg === null) {
        // закрытие соединения
        partConn.close(true)
            .finally(() => parentPort?.postMessage({
                status: "closed",
                partId
            } satisfies WorkerNotification))
    } else {
        // обработка файла
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


