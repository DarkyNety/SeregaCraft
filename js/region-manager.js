// js/region-manager.js
const REGION_SIZE = 32;
const SECTOR_BYTES = 4096;

export class RegionManager {
    constructor(worldName) {
        this.worldName = worldName;
        this.root = null;
    }

    async init() {
        const opfsRoot = await navigator.storage.getDirectory();
        this.root = await opfsRoot.getDirectoryHandle(this.worldName, { create: true });
    }

    getRegionCoords(cx, cz) {
        const rx = Math.floor(cx / REGION_SIZE);
        const rz = Math.floor(cz / REGION_SIZE);
        const lx = ((cx % REGION_SIZE) + REGION_SIZE) % REGION_SIZE;
        const lz = ((cz % REGION_SIZE) + REGION_SIZE) % REGION_SIZE;
        return { rx, rz, lx, lz };
    }

    async getRegionFile(rx, rz) {
        const name = `r.${rx}.${rz}.mca`;
        try { return await this.root.getFileHandle(name); }
        catch { return await this.root.getFileHandle(name, { create: true }); }
    }

    async loadChunk(cx, cz) {
        const { rx, rz, lx, lz } = this.getRegionCoords(cx, cz);
        // ПРАВИЛЬНЫЙ ИНДЕКС: localX * 32 + localZ
        const index = lx * REGION_SIZE + lz;
        const fileHandle = await this.getRegionFile(rx, rz);
        const file = await fileHandle.getFile();
        if (file.size < 8192) return null;

        const header = new DataView(await file.slice(0, 8192).arrayBuffer());
        const offset = header.getUint32(index * 8, false);
        const size = header.getUint32(index * 8 + 4, false);
        if (offset === 0 || size === 0) return null;

        const data = await file.slice(offset * SECTOR_BYTES, offset * SECTOR_BYTES + size * SECTOR_BYTES).arrayBuffer();
        const decompressedStream = new Blob([data]).stream().pipeThrough(new DecompressionStream('gzip'));
        const decompressed = await new Response(decompressedStream).arrayBuffer();
        return new Uint8Array(decompressed);
    }

    async saveChunk(cx, cz, blocks) {
        const { rx, rz, lx, lz } = this.getRegionCoords(cx, cz);
        const index = lx * REGION_SIZE + lz;
        const fileHandle = await this.getRegionFile(rx, rz);

        const compressedStream = new Blob([blocks]).stream().pipeThrough(new CompressionStream('gzip'));
        const compressed = new Uint8Array(await new Response(compressedStream).arrayBuffer());
        const sectors = Math.ceil(compressed.length / SECTOR_BYTES);

        const file = await fileHandle.getFile();
        const oldBuffer = file.size > 0 ? new Uint8Array(await file.arrayBuffer()) : new Uint8Array(8192);
        const headerSize = REGION_SIZE * REGION_SIZE * 8;
        let buffer = oldBuffer.length >= headerSize ? oldBuffer : (() => {
            const b = new Uint8Array(headerSize);
            b.set(oldBuffer);
            return b;
        })();
        const header = new DataView(buffer.buffer);

        let maxEndSector = 2;
        for (let i = 0; i < REGION_SIZE * REGION_SIZE; i++) {
            const off = header.getUint32(i * 8, false);
            const sz = header.getUint32(i * 8 + 4, false);
            const end = off + sz;
            if (off > 0 && sz > 0 && end > maxEndSector) maxEndSector = end;
        }
        const newOffset = maxEndSector;
        header.setUint32(index * 8, newOffset, false);
        header.setUint32(index * 8 + 4, sectors, false);

        const newFileSize = headerSize + (newOffset + sectors) * SECTOR_BYTES;
        const newFileBuffer = new Uint8Array(newFileSize);
        newFileBuffer.set(buffer.subarray(0, headerSize));
        if (oldBuffer.length > headerSize) {
            newFileBuffer.set(oldBuffer.subarray(headerSize), headerSize);
        }
        const padded = new Uint8Array(sectors * SECTOR_BYTES);
        padded.set(compressed);
        newFileBuffer.set(padded, headerSize + newOffset * SECTOR_BYTES);

        const writable = await fileHandle.createWritable();
        await writable.write(newFileBuffer);
        await writable.close();
    }

    async deleteWorld() {
        await this.root.removeEntry(this.worldName, { recursive: true });
    }
}