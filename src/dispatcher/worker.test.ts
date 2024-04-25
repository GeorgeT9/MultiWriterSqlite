import { Worker } from "node:worker_threads"
import { WorkerData } from "./worker"
import { once } from "node:events"
import { genFileNamesFromDir } from "../files/dirReader"
import cfg from "../config"
import path from "node:path"
import { rm } from "node:fs/promises"
import {WorkerNotification} from "./dispatcher"



describe("worker test", () => {

    const partDbFileName = path.resolve(cfg.storeDir, "part_10000.db")

    afterEach(async () => {
        await rm(partDbFileName)
    })

    it("make one worker", async () => {
        const w = new Worker("./dist/dispatcher/worker.js", {
            workerData: {
                partId: 10000,
                sqlInit: cfg.sqlInit,
                watchDir: cfg.watchDir,
                storeDir: cfg.storeDir
            } satisfies WorkerData
        })
        const out: WorkerNotification[] = []
        
        for await (const fileName of genFileNamesFromDir(cfg.watchDir, 0, [".doc", ".docx", ".csv"])) {
            w.postMessage(fileName)
            const res: WorkerNotification = (await (once(w, "message")))[0]
            out.push(res)
        }
        w.postMessage(null)
        const closed: WorkerNotification = (await once(w, "message"))[0]
        out.push(closed)
        await w.terminate()
        expect(out.length).toBe(6)
        expect(out.filter(r => r.status === "closed").length).toBe(1)
    })  
})
