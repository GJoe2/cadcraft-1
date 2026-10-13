# CadCraft for Linux

**Available from 0.4.** The `.deb` and AppImage are in [Releases](https://github.com/getcadcraft/cadcraft/releases).

Both are the [browser edition](../web/), unchanged, in a WebKitGTK window, built by [getcadcraft/desktop-shell](https://github.com/getcadcraft/desktop-shell).

## Flathub

[`flathub/`](flathub/) is the Flathub manifest (`com.getcadcraft.cadcraft.yml`) with its desktop entry, AppStream metainfo, MIME types and icons. It builds from public sources only: the shell's tag and the release zip. Values marked `OWNER:` are filled in at submission.

```sh
flatpak-builder --user --install build-dir flathub/com.getcadcraft.cadcraft.yml
```

## File types

- Opens by default: `.ccsheets` (CadCraft sheet set)
- Opens by default unless another program already does: `.dwg` (DWG drawing), `.dxf` (DXF drawing)
- Listed under "Open with": `.pln` (PLN project), `.pla` (PLA archive), `.tpl` (TPL template), `.bpn` (BPN backup)
