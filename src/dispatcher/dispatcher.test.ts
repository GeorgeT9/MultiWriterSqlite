import { Dispatcher } from "./dispatcher"
import cfg from "../config"



describe("Dispatcher", () => {

    it("regex", () => {
        const filesName = [
            "file1.txt",
            "part_0.db",
            "part_2.db",
        ]
        const res = filesName.filter(el => el.match(/\bpart_\d+\.db\b/))
        expect(res).toEqual(["part_0.db", "part_2.db"])
        console.log(res)
    })

    it("connect", async () => {
        const d = new Dispatcher(cfg.watchDir, cfg.storeDir, 100*1024, cfg.sqlInit)
        await d.process(4)
    })

}) 