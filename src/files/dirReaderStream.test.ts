import { pipeline } from "node:stream/promises"
import { Writable } from "node:stream"
import { genFileNamesFromDir } from "./dirReaderStream"
import { resolve } from "node:path"

describe('dirReaderStream', () => {

    const dir = resolve('./src/__fixtures__') 
    let out: string[] = []
    let writer: Writable 

    beforeEach(() => {
        out = []
        writer = new Writable({
            write(chunk: string, encoding, callback) {
                out.push(chunk)
                callback()
            },
        })
    })

    it('shoul return files with only the allowed extension', async () => {
        const readerFiles = genFileNamesFromDir(dir, 0, ['.csv', '.txt'])
        const out = []
        for await (const f of readerFiles) {
            out.push(f)
        }
        expect(out.length).toBe(4)
    })

    
})