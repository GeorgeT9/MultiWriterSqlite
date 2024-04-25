import { workerData, Worker } from "node:worker_threads"
import path from "node:path";
import { WorkerData } from "./worker";
import { readdir } from "node:fs/promises"
import { FileInfo, genFileNamesFromDir } from "../files/dirReader";
import { PartConnect } from "../database/partConnect";


/** Тип уведомлений от воркера */
export type WorkerNotification =
    SuccessWorkerNotification |
    FailedWorkerNotification |
    ClosedConnectNotification |
    InitNotification


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

interface InitNotification {
    status: "init",
    partId: number
}

type PartId = number

export class Dispatcher {

    private readonly _storeDir: string
    private readonly _watchDir: string
    private readonly _sqlInit: string
    private readonly _limitSizePartDbKb: number
    private readonly _usePartId: Set<number> = new Set()
    private _sizeMap: Map<PartId, number> | null = null
    private _nextNewPartId: number = 0

    constructor(watchDir: string, storeDir: string, limitSizePartDbKb: number, sqlInit: string) {
        this._storeDir = storeDir
        this._watchDir = watchDir
        this._sqlInit = sqlInit
        this._limitSizePartDbKb = limitSizePartDbKb
    }

    async process(worksLimit: number = 4) {
        return new Promise(async (resolve, reject) => {
            const tasks = genFileNamesFromDir(this._watchDir, 0, [".doc", ".docx", ".csv", ".txt"])
            
            const nextTask = async () => {
                const { done, value } = await tasks.next()
                if (done) return null
                return value
            }
            
            for (let i = 0; i < worksLimit; i++) {
                const worker = await this.makePartConnect()
                worker.on("message", function (noti: WorkerNotification) {
                    switch (noti.status) {
                        case "init":
                            console.log(`подключено к part id: ${noti.partId}`);
                            //@ts-ignore this - ссылка на воркер, в котором назначен обработчик
                            nextTask().then((task) => this.postMessage(task)) 
                            break;
                        case "success":
                            console.log(`+ ${noti.fileInfo.fileName}`)
                            //@ts-ignore
                            nextTask().then((task) => this.postMessage(task)) 
                            break;
                        case "failed":
                            console.log(`- ${noti.fileInfo.fileName}: ${noti.errorMessage}`)
                            //@ts-ignore
                            nextTask().then((task) => this.postMessage(task)) 
                            break;
                        case "closed":
                            console.log(`part id: ${noti.partId} закрыто`)
                            //@ts-ignore
                            this.terminate()
                            break;
                        default:
                            break;
                    }
                })

            }
        })
    }

    /**  Создаст подключение в отдельном потоке и вернет worker */
    private async makePartConnect() {
        const partId = await this.getNextPartId()
        const worker = new Worker(path.resolve(__dirname, "worker.js"), {
            workerData: {
                partId,
                sqlInit: this._sqlInit,
                watchDir: this._watchDir,
                storeDir: this._storeDir
            } satisfies WorkerData
        })
        return worker
    }

    /** Вернет partId для создания подключения */
    private async getNextPartId() {
        if (this._sizeMap == null) {
            // выполнение инициализации значений размера существующих partDb и следующего нового partId 
            await this.updateExistsPartsSize();
            const existsMaxId = this._sizeMap!.size ? Math.max(...this._sizeMap!.keys()) : 0
            this._nextNewPartId = existsMaxId + 1
        }
        const couples = [...this._sizeMap!.entries()]
            .filter(([partId, sizeKb]) => (sizeKb < this._limitSizePartDbKb) && !this._usePartId.has(partId))
            .map(([partId, _]) => partId)
        if (couples.length) {
            const partId = couples[0]
            this._usePartId.add(partId)
            return partId
        }
        return this._nextNewPartId++
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
            .filter(entry => /\bpart_\d+\.db\b/.test(entry))
            .map(el => parseInt(el.match(/\d+/)![0], 10))
            .filter(el => el)
            .reduce((acc, cur) => acc.add(cur), new Set<number>)
    }

    /** полный путь к файлу по его partId */
    private async getPathNamePartDb(partId: PartId) {
        return path.resolve(this._storeDir, `part_${partId}.db`)
    }




}