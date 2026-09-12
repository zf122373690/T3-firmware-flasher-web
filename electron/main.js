// T3 副卡宝烧录工具 - Electron 桌面壳
// 用桌面应用替代浏览器，绕过 Web Serial 的手动授权：
// - setDevicePermissionHandler 直接放行 serial 权限
// - select-serial-port 事件自动选择串口，不弹系统选择框
// 页面本身复用根目录的 index.html / js，行为与网页版一致。
const { app, BrowserWindow } = require('electron');
const path = require('path');

// 与 js/modern-app.js 中的 usbPortFilters 保持一致 [VID, PID]
const USB_FILTERS = [
    [0x10c4, 0xea60], /* CP2102/CP2102N */
    [0x0403, 0x6010], /* FT2232H */
    [0x303a, 0x1001], /* Espressif USB_SERIAL_JTAG */
    [0x303a, 0x1002], /* Espressif esp-usb-bridge firmware */
    [0x303a, 0x0002], /* ESP32-S2 USB_CDC */
    [0x303a, 0x0009], /* ESP32-S3 USB_CDC */
    [0x1a86, 0x55d4], /* CH9102F */
    [0x1a86, 0x7523], /* CH340T */
    [0x0403, 0x6001], /* FT232R */
];

function isEspPort(port) {
    const vid = Number(port.usbVendorId ?? parseInt(String(port.vendorId || ''), 16));
    const pid = Number(port.usbProductId ?? parseInt(String(port.productId || ''), 16));
    if (!Number.isFinite(vid) || !Number.isFinite(pid)) return false;
    return USB_FILTERS.some(([v, p]) => vid === v && pid === p);
}

function createWindow() {
    const win = new BrowserWindow({
        width: 1280,
        height: 920,
        autoHideMenuBar: true,
        title: 'T3 副卡宝 · 固件升级',
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    win.loadFile(path.join(__dirname, '..', 'index.html'));

    const ses = win.webContents.session;

    // 放行 Web Serial 权限（对应浏览器里需要用户手动授权的那一步）
    ses.setPermissionCheckHandler((webContents, permission) => permission === 'serial');
    ses.setPermissionRequestHandler((webContents, permission, callback) => {
        callback(permission === 'serial');
    });
    ses.setDevicePermissionHandler((details) => details.deviceType === 'serial');

    // 页面调用 requestPort() 时本会弹出串口选择框，这里改为自动选择：
    // 优先匹配 ESP 相关 VID/PID，否则选第一个端口，实现全程零交互
    ses.on('select-serial-port', (event, portList, webContents, callback) => {
        event.preventDefault();
        const picked = portList.find(isEspPort) || portList[0];
        callback(picked ? picked.portId : '');
    });
}

app.whenReady().then(() => {
    createWindow();
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
