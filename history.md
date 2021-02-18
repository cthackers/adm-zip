0.5.2 / 2021-01-27
==================
 * Fixed path traversal issue (GHSL-2020-198)

0.5.1 / 2020-11-27
==================

 * Incremented version (cthackers)
 * Fixed outFileName (cthackers)

0.5.0 / 2020-11-19
==================
 * Added extra parameter to extractEntryTo so target filename can be renamed (cthackers)
 * Updated dev dependency (cthackers)
 * modified addLocalFolder method (5saviahv)
 * modified addLocalFile method (5saviahv)
 * Deflate needs min V2.0 (5saviahv)
 * Node v6 (5saviahv)
 * Added ZipCrypto decrypting ability (5saviahv)
 * LICENSE filename in package.json (5saviahv)
 * add multibyte-encoded comment with byte length instead of character length (Kosuke Suzuki)
 * Bump lodash from 4.17.15 to 4.17.19 (dependabot[bot])
 * now it works in browser (Emiliano Necciari)

0.4.16 / 2020-06-23
===================
 * Updated mocha version to fix vulnerability (cthackers)
 * Update project version (cthackers)
 * fix: throw real exception objects on error (Matthew Sainsbury)
 * Version number incremented (Saqib M)
 * Update zipFile.js (Saqib M)
 * Update README.md with the latest URLs (Takuya Noguchi)
 * Update Node.js version to use in CI tests (Takuya Noguchi)
 * process.versions is null when the library is used in browser (Emiliano Necciari)

0.4.14 / 2020-02-06
===================
 * Version increment for npm publish (cthackers)
 * Iterate over entries without storing their metadata (Pierre Lehnen)
 * Add partial support for zip64 (larger number of entries) (Pierre Lehnen)
 * Escape $ sign for regex in addLocalFolder() (William)
 * fix accent filename (mart_-)
 * Removed improperly raised error while decompressing empty file asynchronously. (Nicolas Leclerc)
 * fix: CRC is unexpectedly changed after zip is re-created (teppeis)

0.4.13 / 2018-10-18
===================
 * Add async version of addLocalFile Use open and readFile instead of existsSync and readFileSync. There are still some sync functions left in the Utils.findFiles call, but the impact is minimal compared to the readFileSync. (Maigret Aurelien)
 * Fix jsdoc typings for functions. (Leon Aves)
 * fixed Utils.FileSystem overwriting 'fs' module even when 'original-fs' is broken (Tom Wallroth)
 * fix race-condition crash when extracting data and extracted files are (re)moved (Tom Wallroth)
 * Fix: bad buffer.alloc for .toBuffer in async mode (Colin GILLE)
 * Add a full license text to the distribution (Honza Javorek)
 * Rename MIT-LICENSE.txt to LICENSE (Standa Opichal)
 * fix bug when filename or path contains multi-byte characters (warbaby)
 * bump version to 0.4.12 (Marsette Vona)
 * change default compression method for added files back to DEFLATED from STORED (revert #139) (Marsette Vona)
 * remove JSDeflater() and JSInflater() in favor of zlib.deflateRawSync() and zlib.inflateRawSync() respectively (Marsette Vona)
 * Fix (Mirko Tebaldi)
 * 0.4.12 - Created a test to check Twizzeld's issue on Issue #237. (was not able to replicate his issue) (cjacobs)
 * Fix Buffer.alloc bug #234 (keyesdav)
 * 0.4.12 - Fix additional issue with extractEntryTo improperly handling directory children. (cjacobs)
 * 0.4.12 - Fix #237, add tests, update travis node versions. (cjacobs)
 * 0.4.12 - Fix #237, add tests, update travis node versions. (cjacobs)
 * 0.4.12 - Fix #237, add tests, update travis node versions. (cjacobs)
 * 0.4.12 - Fix #237, add tests, update travis node versions. (cjacobs)
 * add tests for CRC fixes (Kevin Tjiam)
 * compare calculated CRC with loaded CRC (Kevin Tjiam)
 * handle errors in callback from getDataAsync (Kevin Tjiam)

0.4.11 / 2018-05-13
===================
 * Version bump (cthackers)
 * Fixed #176 (cthackers)
 * Fixed wrong date on files (issue #203) (cthackers)

0.4.10 / 2018-05-13
===================
 * Fixed bugs introduced with 0.4.9 (File Formats)
 * Fix issue #218 (Jean-Marc Collin)
 * Fix octal literals so they work in strict mode (Houssam Haidar)
 * To support strict mode use 0o prefix to octal numbers (Jon Tore Hafstad)
 * Updated entryHeaderToBinary. Fixed a typo that made the CRC be written as an Int32 instead of a UInt32. (Rafael Costa)

0.4.9 / 2018-04-25
==================
 * Update package.json (The Brain)
 * Update README.md (The Brain)
 * fix: resolve both target and entry path (Danny Grander)

0.4.8 / 2018-04-23
==================
 * Update package.json (The Brain)
 * Update package.json (The Brain)
 * Update package.json (The Brain)
 * fix: prevent extracting archived files outside of target path (Aviad Reich)
 * add try-catch around fs.writeSync (olya)
 * Fix data accessing example in README (Philipp Muens)
 * Remove buffers `noAssert` argument (Ruben Bridgewater)
 * Fix license expression to be compatible to SPDX. (Golo Roden)
 * Added travis ci support (Amila Welihinda)
 * add bug fix on special character in filename that are allowed in linux but not in windows (Ygal Bellaiche)
 * Change project name for publishing to npm (David Kadlecek)
 * Added support for electron original-fs (David Kadlecek)
 * fixed #130: ensure buffer (lloiser)
 * fix Issue: https://github.com/cthackers/adm-zip/issues/102 (mygoare)
 * Update license attribute (Peter deHaan)
 * lowcase for the function name (Changyu Geng)
 * Add a test function (Changyu Geng)
 * Under windows, the path should be normalize first, otherwise the localPath will still use back slash (Shauk Wu)
 * Update adm-zip.js (MikeNerevarin)
 * Fix adm-zip.addFile default attributes for files and directories (Pavel Strashkin)
 * Fixed CRC bug (The Brain)

0.4.7 / 2015-02-09
==================
 * Update zipEntry.js (The Brain)
 * Update package.json (The Brain)

0.4.5 / 2015-02-09
==================
 * Bumped library version for a a npm push (cthackers)
 * Merged pull request (cthackers)
 * Use `files` property in package.json (Kevin Martensson)
 * preserve attr in entry headers (João Moreno)
 * when overwrite flag is set, should check if the target exists, rather than the targetPath (Shauk Wu)
 * + manage cases where paths 'C:/' and 'c:/' are the same (IvanDimanov)
 * writeZip now calles provided callback if given (Adam Booth)
 * Fixed a bug where empty ZIP files were being treated as invalid. (Max Sorensen)
 * Add path.normalize to addLocalFolder (aomurbekov)
 * add an optional filter to addLocalFolder (Gregg Tavares)
 * Bail out after an error (XeonCore)
 * Fix indentation (XeonCore)
 * Add async versions of extractAllTo (XeonCore)
 * added decrypt support (Alexander Skovpen)
 * Fix false report of BAD_CRC on deflated entries in async mode (Julien Chaumond)
 * Added possibility to rename local file when adding it to archive (Taschenschieber)
 * Read ZIP64 extended information (Raphael Schweikert)
 * Add ZIP format specification for reference (Raphael Schweikert)
 * Ignore node_modules directory (Raphael Schweikert)
 * Revert "Start a new" (Iacob Nasca)
 * Revert "Added test files" (Iacob Nasca)
 * Revert "Added zipEntry class" (Iacob Nasca)
 * Revert "Incremented pkg version" (Iacob Nasca)
 * Revert "Waaa, i should never use gui to manage git repos" (Iacob Nasca)
 * Incremented pkg version (Iacob Nasca)
 * Waaa, i should never use gui to manage git repos (Iacob Nasca)
 * Added zipEntry class (Iacob Nasca)
 * Added test files (Iacob Nasca)
 * Start a new (Iacob Nasca)

0.4.4 / 2014-02-04
==================
 * Incremented version to 0.4.4 (The Brain)
 * Update README.md (The Brain)
 * Update README.md (yarsh)
 * Make strict mode compatible - don't use octals (yarsh)
 * Make strict mode compatible - don't use octals in addFile (yarsh)
 * Make strict mode compatible - don't create implicit global "Headers" (yarsh)
 * Make strict mode compatible - don't delete global (yarsh)
 * fix zipFile#deleteEntry. (brn)
 * Updated sample code for zip.extractEntryTo. Added maintainEntryPath parameter. (Third Santor)
 * Fixed issue where chunks of data were not being handled before sending to callback.  Reused the code from inflater. (John Alfaro)
 * Update package.json (The Brain)
 * Add toAsyncBuffer code (Jack Lee)
 * Update zipEntry.js (The Brain)

0.4.3 / 2013-04-11
==================
 * fixed issue #26 (Iacob Nasca)
 * Updated deflater. Fixed more bugs and flows. Some memory improv (Iacob Nasca)
 * Fixed some compression bugs (Iacob Nasca)
 * Incremented project version. Removed some usless files (Iacob Nasca)
 * Fixed crc errors (Iacob Nasca)
 * - (Iacob Nasca)
 * fix isDirectory bug (percy)
 * support multibyte filename (blacktail)

0.2.1 / 2013-03-04
==================
 * Some typos and npm version bumbp (The Brain)
 * Update util/utils.js (Danny Trunk)
 * Fixed issue #15, #12, #13 (The Brain)
 * Fixed path.existSync (issue #27) (The Brain)
 * Fixed issue #29 (The Brain)
 * fixed the call to pth.existsSync to use fs.existsSync (Simon Horton)
 * fixed a "path.existsSync is now called fs.existsSync" warning (Simon Horton)

0.1.9 / 2012-11-05
==================
 * Incremented npm version (The Brain)
 * Merged pull request by sihorton (The Brain)

0.1.8 / 2012-10-11
==================
 * Version increment. NPM push (cthackers)
 * smartly fallback to path.existsSync. (Chris Talkington)

0.1.7 / 2012-09-29
==================
 * New npm push (cthackers)
 * Fix deprecation notice (Peter Rekdal)
 * :gem: Travis CI image/link in readme :gem: (travis4all)
 * :gem: Added travis.yml file :gem: (travis4all)
 * Added license information (The Brain)

0.1.5 / 2012-08-03
==================
 * Version bump for a npm release (The Brain)
 * Adding a class to support fs attributes and permissions (The Brain)
 * Starting a test suite (The Brain)
 * added possibility to unzip data from raw buffer. Just need to pass Buffer. Tested. (Anton Podviaznikov)
 * Fixed writeZip bug (The Brain)
 * Incremented version number for new npm push (The Brain)
 * Fixed async methods (The Brain)

0.1.3 / 2012-03-12
==================
 * Incremented npm build nr (The Brain)
 * Rewrit the Inflater method (The Brain)
 * Implemented Deflater class. Fixed Inflater bug. Some other refactorings (The Brain)
 * Changed nothing (The Brain)
 * Fixed a bug in the data headers (The Brain)
 * Partially implemented addLocalFolder method (The Brain)
 * Added methods documentation (The Brain)
 * Added asynconous decompression and public methods (The Brain)
 * Fixed some doc typos (The Brain)

0.1.2 / 2012-02-28
==================
 * Updated some documentation and version number for npm (The Brain)
 * Refactoring, refactoring, refactoring (The Brain)
 * Fixed zipEntry typo causing null data to be sent to the inflater (The Brain)
 * Fixed crc32 function.\nAdded END header support.\nMoved and renamed some files.\nOther refactoring (The Brain)
 * More refactoring (The Brain)
 * Major major refactoring (The Brain)
 * Added crc32 function (The Brain)

0.1.1 / 2012-02-23
==================
 * Changed md file with the newest api names. Implemented extract to disk methods (The Brain)
 * Fixed deflate bug. Some refactoring (The Brain)
 * Changed some docs (The Brain)
 * Changed some namings. Added new methods (The Brain)
 * More doc (The Brain)
 * More doc (The Brain)
 * More doc (The Brain)
 * Added a bit of documentation (The Brain)
 * Added support for INFLATE method (The Brain)
 * support reading zip files with STORE archive method (The Brain)
 * first commit (The Brain)
