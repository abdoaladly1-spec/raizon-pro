// خدمة الطباعة المباشرة عبر البلوتوث (print_bluetooth_thermal).
// تستقبل بايتات جاهزة من buildReceipt وترسلها للطابعة حرارياً.
//
// الترتيب المعتاد عند الاستخدام:
//   1) تحقق من bluetoothOn + permissionGranted
//   2) اعرض pairedPrinters() واختر الطابعة (macAddress)
//   3) connect(mac) مرة واحدة ثم write(bytes) لكل إيصال
//   4) disconnect() عند الانتهاء

import 'package:print_bluetooth_thermal/print_bluetooth_thermal.dart';

class ThermalPrinterService {
  /// البلوتوث مفعّل على الجهاز؟
  Future<bool> get bluetoothOn => PrintBluetoothThermal.bluetoothEnabled;

  /// إذن BLUETOOTH_CONNECT ممنوح؟ (مطلوب من أندرويد 12 فما فوق)
  Future<bool> get permissionGranted => PrintBluetoothThermal.isPermissionBluetoothGranted;

  /// هل نحن متصلون بطابعة الآن؟
  Future<bool> get isConnected => PrintBluetoothThermal.connectionStatus;

  /// قائمة الطابعات المقترنة (الاسم + macAddress).
  Future<List<BluetoothInfo>> pairedPrinters() => PrintBluetoothThermal.pairedBluetooths;

  /// فتح اتصال بطابعة بعنوانها mac.
  Future<bool> connect(String macAddress) =>
      PrintBluetoothThermal.connect(macPrinterAddress: macAddress);

  /// إرسال بايتات الإيصال (مخرجات buildReceipt) للطابعة.
  Future<bool> write(List<int> bytes) => PrintBluetoothThermal.writeBytes(bytes);

  /// طباعة إيصال جاهز: يتطلب اتصالاً مفتوحاً مسبقاً.
  Future<bool> printReceipt(List<int> bytes) async {
    if (!await PrintBluetoothThermal.connectionStatus) return false;
    return PrintBluetoothThermal.writeBytes(bytes);
  }

  /// إغلاق الاتصال.
  Future<bool> disconnect() => PrintBluetoothThermal.disconnect;
}
