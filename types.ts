export type ZipFileType = {
    readonly entries: any[];
    comment: string;
    getEntryCount: () => any;
    forEach: (callback: any) => void;
    getEntry: (entryName: any) => any;
    setEntry: (entry: any) => void;
    deleteEntry: (entryName: any) => void;
    getEntryChildren: (entry: any) => any[];
    compressToBuffer: () => Buffer;
    toAsyncBuffer: (onSuccess?: any, onFail?: any, onItemStart?: any, onItemEnd?: any) => void;
};
