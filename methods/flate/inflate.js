var maxCodeLen = 6,
    maxHist = 32768,
    maxLit = 286,
    maxDist = 32,
    numCodes = 19,
    huffmanChunkBits = 9,
    huffmanNumChunks  = 1 << huffmanChunkBits,
    huffmanCountMask  = 15,
    huffmanValueShift = 4;


function huffmanDecode() {
    var _self = this;

    this.min = 0; // the minimum code length
    this.chunks = []; // chunks as described above
    this.links = []; // overflow links
    this.linkMask = 0; // mask the width of the link table

    // Initialize Huffman decoding tables from array of code lengths.
    this.init = function(bits) {

    }
}