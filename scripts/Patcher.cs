using System;
using System.IO;
using System.Diagnostics;
using System.Windows.Forms;

namespace RaiZonPro.PatcherLauncher
{
    static class Program
    {
        [STAThread]
        static void Main(string[] args)
        {
            try
            {
                string baseDir = AppDomain.CurrentDomain.BaseDirectory;
                string exeName = "RaiZon Pro.exe";

                string[] candidatePaths = new string[]
                {
                    Path.Combine(baseDir, exeName),
                    Path.Combine(baseDir, "..", exeName),
                    Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs", "procashier-system", exeName),
                    Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "RaiZon Pro", exeName),
                    Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "RaiZon Pro", exeName),
                    Path.Combine(baseDir, "release", "win-unpacked", exeName)
                };

                string targetExe = null;
                foreach (string path in candidatePaths)
                {
                    if (File.Exists(path))
                    {
                        targetExe = Path.GetFullPath(path);
                        break;
                    }
                }

                if (string.IsNullOrEmpty(targetExe))
                {
                    MessageBox.Show(
                        "تعذر العثور على ملف تشغيل التطبيق (RaiZon Pro.exe).\nيرجى التأكد من تثبيت النظام أولاً أو وضع Patcher بجانب ملف التطبيق.",
                        "RaiZon Patcher Pro",
                        MessageBoxButtons.OK,
                        MessageBoxIcon.Warning
                    );
                    return;
                }

                ProcessStartInfo psi = new ProcessStartInfo();
                psi.FileName = targetExe;
                psi.Arguments = "--patcher";
                psi.WorkingDirectory = Path.GetDirectoryName(targetExe);
                psi.UseShellExecute = true;

                Process.Start(psi);
            }
            catch (Exception ex)
            {
                MessageBox.Show(
                    "حدث خطأ أثناء تشغيل Patcher:\n" + ex.Message,
                    "RaiZon Patcher Error",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error
                );
            }
        }
    }
}
