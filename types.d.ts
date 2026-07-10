/// <reference types="node" />

import type { Stats } from "fs";

declare namespace AdmZip {
    /** Options accepted by the AdmZip constructor. */
    interface InitOptions {
        /** If true, disables sorting of the entries by name. */
        noSort: boolean;
        /** Read all entries during load (slower initial load, avoids lazy parsing later). */
        readEntries: boolean;
        /** Default compression method for new entries (see Constants: STORED = 0, DEFLATED = 8). */
        method: number;
        /** Custom filesystem implementation (e.g. Electron's `original-fs`). */
        fs: unknown | null;
        /** Filename used by `writeZip`/`writeZipPromise` when none is supplied. */
        filename?: string;
        /** Raw zip buffer to load (alternative to passing a Buffer as the first argument). */
        input?: Buffer;
        /** Custom text encoder/decoder for entry names (e.g. to support MBCS via iconv-lite). */
        decoder?: ZipTextDecoder;
    }

    /** Encoder/decoder used for entry names and comments. */
    interface ZipTextDecoder {
        /** Whether names are encoded as UTF-8 (sets the EFS flag). May be a predicate per name. */
        efs?: boolean | ((entryName: string) => boolean);
        encode(data: string): Buffer;
        decode(data: Buffer | Uint8Array): string;
    }

    /** Filter deciding whether an entry is included when adding a local folder. */
    type EntryFilter = RegExp | ((entryPath: string) => boolean);

    /** The central-directory / local file header of a single entry. */
    interface IZipEntryHeader {
        made: number;
        version: number;
        flags: number;
        flags_efs: boolean;
        flags_desc: boolean;
        method: number;
        time: Date;
        timeval: number;
        readonly timeHighByte: number;
        crc: number;
        compressedSize: number;
        size: number;
        fileNameLength: number;
        extraLength: number;
        extraLocalLength: number;
        commentLength: number;
        diskNumStart: number;
        inAttr: number;
        attr: number;
        /** Unix permission bits (e.g. 0o755), derived from `attr`. */
        readonly fileAttr: number;
        offset: number;
        readonly encrypted: boolean;
        readonly centralHeaderSize: number;
        readonly realDataOffset: number;
        readonly localHeader: Record<string, number | boolean>;
        loadLocalHeaderFromBinary(input: Buffer): Buffer;
        loadFromBinary(data: Buffer): void;
        localHeaderToBinary(): Buffer;
        centralHeaderToBinary(): Buffer;
        toJSON(): object;
        toString(): string;
    }

    /** A single file or directory inside the archive. */
    interface IZipEntry {
        /** Full path of the entry within the archive. */
        entryName: string;
        /** Raw (un-decoded) entry name bytes. */
        readonly rawEntryName: Buffer;
        /** The base name of the entry (last path segment). */
        readonly name: string;
        /** Extra field bytes. */
        extra: Buffer;
        /** Entry comment. */
        comment: string;
        readonly isDirectory: boolean;
        /** Whether the name uses UTF-8 (EFS) encoding. */
        readonly efs: boolean;
        header: IZipEntryHeader;
        /** MS-DOS / unix packed attribute value. */
        attr: number;
        getCompressedData(): Buffer;
        getCompressedDataAsync(callback: (data: Buffer) => void): void;
        setData(value: string | Buffer): void;
        /** Decompress and return the entry content. Throws on a bad CRC. */
        getData(pass?: string | Buffer): Buffer;
        getDataAsync(callback: (data: Buffer, err?: string) => void, pass?: string | Buffer): void;
        packCentralHeader(): Buffer;
        packLocalHeader(): Buffer;
        toJSON(): object;
        toString(): string;
    }
}

declare class AdmZip {
    /**
     * @param fileNameOrRawData Path to a zip file, a Buffer with zip data, or an options object.
     * @param options Additional options.
     */
    constructor(fileNameOrRawData?: string | Buffer, options?: Partial<AdmZip.InitOptions>);
    constructor(options?: Partial<AdmZip.InitOptions>);

    /** Extract an entry and return its content as a Buffer, or null if not found. */
    readFile(entry: string | AdmZip.IZipEntry, pass?: string | Buffer): Buffer | null;

    /** Number of child entries for a directory entry (0 for files). */
    childCount(entry: string | AdmZip.IZipEntry): number;

    /** Asynchronously extract an entry's content. */
    readFileAsync(entry: string | AdmZip.IZipEntry, callback: (data: Buffer | null, err?: string) => void): void;

    /** Extract an entry and return its content as text (default encoding utf8). */
    readAsText(entry: string | AdmZip.IZipEntry, encoding?: string): string;

    /** Asynchronously extract an entry's content as text. */
    readAsTextAsync(entry: string | AdmZip.IZipEntry, callback: (data: string, err?: string) => void, encoding?: string): void;

    /** Remove an entry (and, for a directory, optionally its children). */
    deleteFile(entry: string | AdmZip.IZipEntry, withSubfolders?: boolean): void;

    /** Remove a single entry. */
    deleteEntry(entry: string | AdmZip.IZipEntry): void;

    /** Set the archive-level comment. */
    addZipComment(comment: string): void;

    /** Get the archive-level comment. */
    getZipComment(): string;

    /** Set the comment of a single entry. */
    addZipEntryComment(entry: string | AdmZip.IZipEntry, comment: string): void;

    /** Get the comment of a single entry. */
    getZipEntryComment(entry: string | AdmZip.IZipEntry): string;

    /** Replace the content of an existing entry. */
    updateFile(entry: string | AdmZip.IZipEntry, content: Buffer): void;

    /** Add a file from disk to the archive. */
    addLocalFile(localPath: string, zipPath?: string, zipName?: string, comment?: string): void;

    /** Asynchronously add a file from disk to the archive. */
    addLocalFileAsync(
        options: string | { localPath: string; zipPath?: string; zipName?: string; comment?: string },
        callback: (err: Error | undefined, done: boolean) => void
    ): void;

    /** Add a folder and all of its nested files/directories to the archive. */
    addLocalFolder(localPath: string, zipPath?: string, filter?: AdmZip.EntryFilter): void;

    /** Asynchronously add a folder and its contents to the archive. */
    addLocalFolderAsync(localPath: string, callback: (success?: boolean, err?: string) => void, zipPath?: string, filter?: AdmZip.EntryFilter): void;

    /** Asynchronously add a folder and its contents to the archive. */
    addLocalFolderAsync2(
        options: string | { localPath: string; zipPath?: string; filter?: AdmZip.EntryFilter; namefix?: "latin1" | ((name: string) => string) },
        callback: (err: Error | undefined, done?: boolean) => void
    ): void;

    /** Promise-returning variant of `addLocalFolderAsync2`. */
    addLocalFolderPromise(localPath: string, props?: { zipPath?: string; filter?: AdmZip.EntryFilter; namefix?: "latin1" | ((name: string) => string) }): Promise<void>;

    /**
     * Create an entry from in-memory content.
     * For a directory, `entryName` must end in `/` and `content` should be an empty buffer.
     * @param attr Unix permission bits as a number, or a filesystem `Stats` object.
     */
    addFile(entryName: string, content: Buffer | string, comment?: string, attr?: number | Stats): AdmZip.IZipEntry;

    /** All entries in the archive. */
    getEntries(password?: string): AdmZip.IZipEntry[];

    /** Look up a single entry by name, or null if absent. */
    getEntry(name: string): AdmZip.IZipEntry | null;

    /** Number of entries in the archive. */
    getEntryCount(): number;

    /** Iterate every entry. */
    forEach(callback: (entry: AdmZip.IZipEntry) => void): void;

    /** Extract a single entry (or a directory subtree) to disk. Returns success. */
    extractEntryTo(
        entry: string | AdmZip.IZipEntry,
        targetPath: string,
        maintainEntryPath?: boolean,
        overwrite?: boolean,
        keepOriginalPermission?: boolean,
        outFileName?: string
    ): boolean;

    /** Verify every entry decompresses with a valid CRC. */
    test(pass?: string | Buffer): boolean;

    /** Extract the entire archive to disk. */
    extractAllTo(targetPath: string, overwrite?: boolean, keepOriginalPermission?: boolean, pass?: string | Buffer): void;

    /** Asynchronously extract the entire archive to disk. Returns a Promise when no callback is given. */
    extractAllToAsync(targetPath: string, overwrite?: boolean, keepOriginalPermission?: boolean): Promise<void>;
    extractAllToAsync(targetPath: string, overwrite: boolean, keepOriginalPermission: boolean, callback: (error?: Error) => void): void;

    /** Write the archive to disk (uses the constructor filename if none supplied). */
    writeZip(targetFileName?: string, callback?: (error: Error | null) => void): void;

    /** Promise-returning variant of `writeZip`. */
    writeZipPromise(targetFileName?: string, props?: { overwrite?: boolean; perm?: number }): Promise<void>;

    /** Serialize the archive to a Buffer asynchronously. */
    toBufferPromise(): Promise<Buffer>;

    /** Serialize the archive to a Buffer. With callbacks it runs asynchronously and returns null. */
    toBuffer(): Buffer;
    toBuffer(onSuccess: (buffer: Buffer) => void, onFail?: (error: unknown) => void, onItemStart?: (name: string) => void, onItemEnd?: (name: string) => void): null;
}

export = AdmZip;
