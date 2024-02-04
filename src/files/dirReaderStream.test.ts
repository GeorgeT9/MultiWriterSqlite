import { pipeline } from "node:stream/promises"
import { Writable } from "node:stream"
import { dirReaderStream } from "./dirReaderStream"
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

    it('should return all files names', async () => {
        const reader = dirReaderStream(dir)
        await pipeline(reader, writer)
        expect(out.length).toBe(8)
    })

    it('shoul return files with only the allowed extension', async () => {
        const reader = dirReaderStream(dir, ['.csv', '.txt'])
        await pipeline(reader, writer, {})
        expect(out.length).toBe(4)
    })

    
})