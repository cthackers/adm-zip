import { AdmZip } from "../adm-zip";

var zip = new AdmZip("./test/assets/ultra.zip");
zip.extractAllTo("./test/xxx");
