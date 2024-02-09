import { getConnectToPartDb, closeAllConnections, getConnectionMasterDb } from "./connect"
import { resolve } from "node:path"


describe('shoul make new partDb file', () => {
    const dirStore = resolve(__dirname, '../store')
    const partDbName = resolve(dirStore, 'part_1.db')

    afterEach(async () => {
        await closeAllConnections()
    })

    it('should create partDb file', async () => {
        const conn = getConnectToPartDb(1)
        const res = await conn('values').select('*')
        expect(res).toBeTruthy()
    })

})
