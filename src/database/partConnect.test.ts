import { PartConnect } from "./partConnect"
import fs from "node:fs"
import path from "node:path"
import cfg from "../config"


describe("PartConnect test", () => {

    const testPartId = 100000

    it("should create file db", async () => {
        const partConn = new PartConnect(testPartId, cfg.storeDir, cfg.sqlInit)
        const res = await partConn.getFileByName("");
        console.log("part_db file: " + partConn.fullFileDbName)
        expect(partConn.partId).toBe(testPartId)
        expect(existsPartDb(partConn)).toBeTruthy()
    })    

    function existsPartDb(conn: PartConnect ) {
        try {
            fs.accessSync(conn.fullFileDbName, fs.constants.F_OK)
            return true
        } catch {
            return false
        }

    }
})