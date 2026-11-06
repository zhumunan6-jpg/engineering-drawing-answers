# 工程制图答案

面向 iPhone 的静态答案阅读器，按 PDF 第 1～80 页浏览。

[打开阅读器](https://zhumunan6-jpg.github.io/engineering-drawing-answers/)

- 输入页码、缩略图目录、前后翻页、连续阅读。
- 手机图按需加载，放大后切换高清图，保留横竖页面原始比例。
- 自动恢复阅读位置和缩放，支持页面收藏、页面链接和专注阅读。
- 已读页自动缓存，可主动保存全部页面，含高清图和目录；中断后可继续。
- Safari 分享菜单中选择“添加到主屏幕”，可作为独立窗口的网页应用使用。
- 纯 HTML、CSS、JavaScript；无框架、构建步骤、运行时依赖、统计脚本或外部字体。

## 使用与发布

GitHub Pages 发布源：`main` 分支的 `/docs`。所有资源使用相对路径，兼容仓库子目录。

本地运行：`python -m http.server 8000 --directory docs`，打开 `http://localhost:8000`。

当前页链接形如 `#p=12`。收藏和阅读位置仅存于当前设备；离线缓存可能由 iOS 清理，离线前可在“离线保存”中检查。

## 资料与隐私

只发布重新渲染的 80 页图片，不发布源 PDF、隐藏 PDF 元数据、临时文件、本地配置或个人文件路径。图纸标题栏在发布前已检查，未发现填写的姓名、学号或联系方式。

网页不上传阅读记录。GitHub Pages 托管服务可能记录访问日志。原稿答案未作校正，资料版权归原权利人。

## 源码参考

借鉴同账号的 [physics-homework-answers](https://github.com/zhumunan6-jpg/physics-homework-answers)：复用连续原页、`loadPage` / `loadWindow` 按需加载、高清切换、缩放、进度恢复，以及网页与图片分开缓存的实现思路。去掉作业和题号索引；页码位置改为按每页实际高度计算，适配横竖混排。
