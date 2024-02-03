import { resolve } from "node:path"
import { createReadStream } from "node:fs"
import { Readable, Writable } from "node:stream"
import { pipeline } from "node:stream/promises"
import { LinerStream } from "./linerStream"
import { Line } from "../handlers/handlers.types"

describe(('LinerStream'), () => {
    
    const fileName =  resolve(__dirname, "../../__fixtures__/data/data1.csv")
    
    let reader: Readable
    let out: Line[] = []
    let writer: Writable

    beforeEach(() => {
        out = []
        reader = createReadStream(fileName)
        writer = new Writable({ 
            objectMode: true,
            write(chunk: Line, encoding, callback) {
                out.push(chunk)
                callback()
            },
        })
    })

    it('should transform all rows to lines', async () => {
        await pipeline(reader, new LinerStream(), writer)
        expect(out.length).toBeGreaterThan(1)
        expect(out[0].length).toBe(2)
    })
})