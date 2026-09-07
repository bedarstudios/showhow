# Verification log

- [passed] Original audit MP4 is 7,542,944 bytes, 1920x1080 at 60 fps.
- [passed] Baseline source, project and export SHA-256 hashes recorded.
- [passed] Supplied settings screenshot shows selected 1080p upscale.
- [untested] Baseline encoding time was not recorded in supplied evidence.
- [passed] Installed app loaded the audit .showhow via Load Project.
- [passed] Live export panel retained selected 1080p upscale.
- [passed] Live installed-app export reproduces original MP4 byte count.
- [passed] Reproduced export: 7,542,944 bytes, 1080p60, 18.933333 seconds.
- [passed] Save-click to output mtime: 52.561 seconds on installed app.
- [passed] Baseline original export/source/project hashes remain unchanged.
- [untested] Editor seek/play: timer advances but preview appears stuck.
- [passed] Installed app returned to idle recorder; GUI slot released.
