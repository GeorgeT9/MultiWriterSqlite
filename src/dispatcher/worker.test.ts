import { Worker } from "node:worker_threads"
import { WorkerData } from "./worker"
import { once } from "node:events"
import { genFileNamesFromDir } from "../files/dirReader"
import cfg from "../config"
import path, { resolve } from "node:path"
import { rm } from "node:fs/promises"
import {WorkerNotification} from "./dispatcher"



describe("worker test", () => {

    const partDbFileName = path.resolve(cfg.storeDir, "part_9999.db")

    afterEach(async () => {
        await rm(partDbFileName)
    })

    it("make one worker", async () => {
        const w = new Worker("./dist/dispatcher/worker.js", {
            workerData: {
                partId: 9999,
                sqlInit: cfg.sqlInit,
                watchDir: cfg.watchDir,
                storeDir: cfg.storeDir
            } satisfies WorkerData
        })
        const out: WorkerNotification[] = []
        
        for await (const fileName of genFileNamesFromDir(path.resolve(__dirname, "../../__fixtures__"), 0, [".doc", ".docx", ".csv"])) {
            w.postMessage(fileName)
            const res: WorkerNotification = (await (once(w, "message")))[0]
            out.push(res)
        }
        await w.terminate()
        expect(out.length).toBe(5)
    })  
})
