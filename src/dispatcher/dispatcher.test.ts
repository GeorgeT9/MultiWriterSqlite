


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

}) 