# FFmpeg / static lxml source and replacement materials

These are third-party sources under their **original** grants, not MIT relabeling.
Archive08 is source/text only. It contains neither Office023/npm runtime archives,
Python/Node executables, nor the previous iconv test executables/object libraries.

## FFmpeg (LGPL2.1-or-later selection)

Exact Chromium fork: `2b68d2babae73714846961fb0ee47e3b3d2e39a9`.
The original source includes `COPYING.LGPLv2.1`, all source and Chromium
`chromium/scripts/build_ffmpeg.py` / Windows configurations. Both Chrome and
Chromium win/x64 config.h disable GPL/NONFREE/VERSION3. Preserve these selections.
Use the included upstream script/help and `BUILD.gn`, with Chromium152.0.7977.130
and Electron44.7.0 build tools described by their official build documentation.
Their optional full source locations/checksums remain in source-materials.lock.json;
they are not all made mandatory LGPL delivery just because a permissive executable
uses a dynamically loaded FFmpeg library.

A recipient may replace the installed outer `ffmpeg.dll` with an ABI-compatible
build and restart the app. It is not inside ASAR. No ymzz term prohibits debugging
or reverse engineering for LGPL modification. This is the replacement mechanism,
not a claim that a newly modified FFmpeg build has been executed in Windows.

## lxml6.1.3 / iconv1.17 (static LGPL2.1)

Archive08 supplies full lxml sdist, exact **four gitlinked source repositories** and
original complete build recipe+patches from lxml/libxml2-win-binaries2026.05.17:
libiconv880a1fa, libxml2bb84678, libxsltc0076ea, zlib0089522.
This is not merely GNU sources with similar version numbers, prebuilt .lib files,
or a list of URLs. The Windows source recipe contains libiconv.patch, build.ps1,
CMake arguments and its original notices. Restore each source archive into its
matching submodule directory beside build.ps1; apply its original libiconv.patch
before building as its `.github/workflows/main.yml` specifies.

Use a VS2022 x64 development shell. Review/build the original build.ps1 `-x64`
recipe locally; do not run its publishing workflow. Keep original patches/notices.
Its outputs provide include/ and static lib/ inputs for all four components.
Extract lxml sdist, set INCLUDE to those four source/build include directories,
LIBRARY to their built static library directories, and CFLAGS to
`/DLIBXML_STATIC /DLIBXSLT_STATIC /DLIBEXSLT_STATIC /DLIBICONV_STATIC`.
Run CPython3.12 x64 `setup.py --static --without-cython build_ext --inplace`.
The included qualify-iconv-relink.py documents the actual successful modified
iconv metadata + lxml relink probe (it can download prebuilt *other* permissive
link inputs for that historical probe). Those prebuilt inputs are NOT in08;
full matching source and original build recipe are supplied instead.

After rebuilding, preserve outside copies, replace the derived lxml extension(s)
and restart Python/app. Compare etree.LIBXML_COMPILED_VERSION,
LIBXSLT_COMPILED_VERSION, ICONV_COMPILED_VERSION and ISO-8859-1/XSLT results.
The historical modified-iconv probe is not a new exact-head Windows GUI run,
not a modified full XML source rebuild, and not global release/legal clearance.
