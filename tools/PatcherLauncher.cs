using System;
using System.Diagnostics;
using System.IO;
using System.Windows.Forms;

namespace RaiZonPro
{
    static class PatcherLauncher
    {
        [STAThread]
        static void Main(string[] args)
        {
            try
            {
                string baseDir = AppDomain.CurrentDomain.BaseDirectory;
                string exePath = Path.Combine(baseDir, "RaiZon Pro.exe");

                if (!File.Exists(exePath))
                {
                    string[] candidates = new string[]
                    {
                        Path.Combine(baseDir, "..", "RaiZon Pro.exe"),
                        Path.Combine(baseDir, "win-unpacked", "RaiZon Pro.exe"),
                        Path.Combine(baseDir, "..", "win-unpacked", "RaiZon Pro.exe"),
                        Path.Combine(baseDir, "release", "win-unpacked", "RaiZon Pro.exe"),
                        Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "RaiZon Pro", "RaiZon Pro.exe"),
                        Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs", "RaiZon Pro", "RaiZon Pro.exe")
                    };

                    foreach (var c in candidates)
                    {
                        if (File.Exists(c))
                        {
                            exePath = Path.GetFullPath(c);
                            break;
                        }
                    }
                }

                if (!File.Exists(exePath))
                {
                    MessageBox.Show(
                        "لم يتم العثور على الملف الرئيسي للنظام (RaiZon Pro.exe).\nيرجى التأكد من تشغيل الباتشر من نفس مجلد البرنامج.",
                        "RaiZon Patcher",
                        MessageBoxButtons.OK,
                        MessageBoxIcon.Error);
                    return;
                }

                var psi = new ProcessStartInfo
                {
                    FileName = exePath,
                    Arguments = "--patcher",
                    WorkingDirectory = Path.GetDirectoryName(exePath)
                };
                Process.Start(psi);
            }
            catch (Exception ex)
            {
                MessageBox.Show(
                    "حدث خطأ أثناء تشغيل أداة الباتشر:\n" + ex.Message,
                    "RaiZon Patcher Error",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error);
            }
        }
    }
}
