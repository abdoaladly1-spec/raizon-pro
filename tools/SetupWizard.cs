using System;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Security.Principal;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Effects;
using System.Windows.Media.Imaging;
using Microsoft.Win32;

namespace RaiZonInstaller
{
    public class App : Application
    {
        [STAThread]
        public static void Main(string[] args)
        {
            if (!IsAdministrator())
            {
                try
                {
                    var startInfo = new ProcessStartInfo
                    {
                        FileName = Assembly.GetExecutingAssembly().Location,
                        Arguments = args != null && args.Length > 0 ? string.Join(" ", args) : "",
                        UseShellExecute = true,
                        Verb = "runas"
                    };
                    Process.Start(startInfo);
                    return;
                }
                catch
                {
                    // User declined UAC, continue
                }
            }

            bool isSilent = args != null && Array.Exists(args, a => 
                !string.IsNullOrEmpty(a) && (
                    a.Equals("/S", StringComparison.OrdinalIgnoreCase) || 
                    a.Equals("/SILENT", StringComparison.OrdinalIgnoreCase) || 
                    a.Equals("/VERYSILENT", StringComparison.OrdinalIgnoreCase) || 
                    a.Equals("--silent", StringComparison.OrdinalIgnoreCase) ||
                    a.Equals("--auto-update", StringComparison.OrdinalIgnoreCase)
                )
            );

            if (isSilent)
            {
                RunSilentInstall(args);
                return;
            }

            var app = new App();
            app.Run(new InstallerWindow(args));
        }

        private static void RunSilentInstall(string[] args)
        {
            try
            {
                string targetDir = InstallerWindow.DetectExistingInstallDir(args);
                if (string.IsNullOrEmpty(targetDir))
                {
                    targetDir = @"C:\Program Files\RaiZon Pro";
                }

                int retries = 0;
                while (retries < 12)
                {
                    var procs = Process.GetProcessesByName("RaiZon Pro");
                    if (procs == null || procs.Length == 0) break;
                    try
                    {
                        foreach (var p in procs)
                        {
                            if (!p.HasExited) p.Kill();
                        }
                    }
                    catch { }
                    Thread.Sleep(500);
                    retries++;
                }

                Directory.CreateDirectory(targetDir);
                var asm = Assembly.GetExecutingAssembly();
                using (var stream = asm.GetManifestResourceStream("AppPayload"))
                {
                    if (stream != null)
                    {
                        using (var zip = new ZipArchive(stream, ZipArchiveMode.Read))
                        {
                            foreach (var entry in zip.Entries)
                            {
                                string destFile = Path.Combine(targetDir, entry.FullName);
                                string destFolder = Path.GetDirectoryName(destFile);
                                if (!string.IsNullOrEmpty(destFolder))
                                    Directory.CreateDirectory(destFolder);

                                if (!string.IsNullOrEmpty(entry.Name))
                                {
                                    entry.ExtractToFile(destFile, true);
                                }
                            }
                        }
                    }
                }

                InstallerWindow.CreateShortcutsStatic(targetDir);
                InstallerWindow.RegisterUninstallerStatic(targetDir);

                string mainExe = Path.Combine(targetDir, "RaiZon Pro.exe");
                if (File.Exists(mainExe))
                {
                    Process.Start(new ProcessStartInfo
                    {
                        FileName = mainExe,
                        WorkingDirectory = targetDir
                    });
                }
            }
            catch (Exception ex)
            {
                try
                {
                    File.WriteAllText(Path.Combine(Path.GetTempPath(), "raizon_update_error.log"), ex.ToString());
                }
                catch { }
            }
        }

        private static bool IsAdministrator()
        {
            try
            {
                var identity = WindowsIdentity.GetCurrent();
                var principal = new WindowsPrincipal(identity);
                return principal.IsInRole(WindowsBuiltInRole.Administrator);
            }
            catch
            {
                return false;
            }
        }
    }

    public class InstallerWindow : Window
    {
        private TextBox txtPath;
        private Grid viewWelcome;
        private Grid viewInstalling;
        private Grid viewCompleted;
        private ProgressBar prgBar;
        private TextBlock lblStatus;
        private TextBlock lblPercent;
        private CheckBox chkLaunch;
        private CheckBox chkDesktopShortcut;
        private CheckBox chkWelcomeDesktop;

        private Border btnNextBorder;
        private TextBlock btnNextText;
        private Border btnBackBorder;
        private TextBlock btnBackText;
        private Border btnCancelBorder;
        private Border btnBrowseBorder;

        // Custom Exit Confirmation Modal Overlay
        private Grid modalOverlay;
        private bool isConfirmedExit = false;

        private string installDir = @"C:\Program Files\RaiZon Pro";

        public InstallerWindow(string[] args = null)
        {
            string detectedDir = DetectExistingInstallDir(args);
            if (!string.IsNullOrEmpty(detectedDir))
            {
                installDir = detectedDir;
            }
            Title = "برنامج تثبيت RaiZon Pro - مساعد التثبيت";
            Width = 800;
            Height = 520;
            WindowStartupLocation = WindowStartupLocation.CenterScreen;
            WindowStyle = WindowStyle.None;
            AllowsTransparency = true;
            Background = Brushes.Transparent;

            // Outer border matching user screenshot exactly
            var outerBorder = new Border
            {
                CornerRadius = new CornerRadius(14),
                BorderThickness = new Thickness(1.5),
                BorderBrush = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#482278")),
                Background = new LinearGradientBrush(
                    (Color)ColorConverter.ConvertFromString("#120921"),
                    (Color)ColorConverter.ConvertFromString("#090510"),
                    new Point(0, 0),
                    new Point(0, 1)
                ),
                Effect = new DropShadowEffect
                {
                    Color = (Color)ColorConverter.ConvertFromString("#581c87"),
                    BlurRadius = 32,
                    ShadowDepth = 0,
                    Opacity = 0.6
                }
            };

            var mainContainer = new Grid();

            var rootGrid = new Grid();
            rootGrid.RowDefinitions.Add(new RowDefinition { Height = new GridLength(42) }); // Title Bar
            rootGrid.RowDefinitions.Add(new RowDefinition { Height = new GridLength(1, GridUnitType.Star) }); // Views Host
            rootGrid.RowDefinitions.Add(new RowDefinition { Height = new GridLength(64) }); // Bottom Footer Bar

            // 1. Title bar
            var titleBar = CreateTitleBar();
            Grid.SetRow(titleBar, 0);
            rootGrid.Children.Add(titleBar);

            // 2. Views Container
            var viewsHost = new Grid();

            viewWelcome = CreateWelcomeView();
            viewsHost.Children.Add(viewWelcome);

            viewInstalling = CreateInstallingView();
            viewInstalling.Visibility = Visibility.Collapsed;
            viewsHost.Children.Add(viewInstalling);

            viewCompleted = CreateCompletedView();
            viewCompleted.Visibility = Visibility.Collapsed;
            viewsHost.Children.Add(viewCompleted);

            Grid.SetRow(viewsHost, 1);
            rootGrid.Children.Add(viewsHost);

            // 3. Bottom Footer Bar
            var footerBar = CreateFooterBar();
            Grid.SetRow(footerBar, 2);
            rootGrid.Children.Add(footerBar);

            mainContainer.Children.Add(rootGrid);

            // 4. Custom Confirmation Modal Overlay in the Exact Same Dark Theme
            modalOverlay = CreateConfirmModal();
            modalOverlay.Visibility = Visibility.Collapsed;
            mainContainer.Children.Add(modalOverlay);

            outerBorder.Child = mainContainer;
            Content = outerBorder;

            // Intercept window closing to enforce confirmation
            Closing += (s, e) =>
            {
                if (!isConfirmedExit && viewCompleted.Visibility != Visibility.Visible)
                {
                    e.Cancel = true;
                    ShowConfirmModal();
                }
            };
        }

        private Grid CreateTitleBar()
        {
            var titleGrid = new Grid
            {
                Background = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#10081d")),
                Height = 42
            };
            titleGrid.MouseLeftButtonDown += (s, e) => { if (e.LeftButton == MouseButtonState.Pressed) DragMove(); };

            // Left: Icon + Title Text
            var leftStack = new StackPanel
            {
                Orientation = Orientation.Horizontal,
                HorizontalAlignment = HorizontalAlignment.Left,
                VerticalAlignment = VerticalAlignment.Center,
                Margin = new Thickness(16, 0, 0, 0)
            };

            var iconSource = GetAppIcon();
            if (iconSource != null)
            {
                leftStack.Children.Add(new Image
                {
                    Source = iconSource,
                    Width = 20,
                    Height = 20,
                    Margin = new Thickness(0, 0, 10, 0)
                });
            }

            leftStack.Children.Add(new TextBlock
            {
                Text = "برنامج تثبيت RaiZon Pro - مساعد التثبيت",
                Foreground = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#ded7f7")),
                FontSize = 13,
                FontWeight = FontWeights.SemiBold,
                VerticalAlignment = VerticalAlignment.Center
            });
            titleGrid.Children.Add(leftStack);

            // Right: Standard Window Controls
            var rightStack = new StackPanel
            {
                Orientation = Orientation.Horizontal,
                HorizontalAlignment = HorizontalAlignment.Right,
                VerticalAlignment = VerticalAlignment.Center,
                Margin = new Thickness(0, 0, 10, 0)
            };

            var btnMin = CreateTitleButton("—", 12, () => WindowState = WindowState.Minimized);
            var btnMax = CreateTitleButton("◻", 11, null, false, true); // disabled, dark
            var btnClose = CreateTitleButton("✕", 13, () => ShowConfirmModal(), true); // requires confirmation!

            rightStack.Children.Add(btnMin);
            rightStack.Children.Add(btnMax);
            rightStack.Children.Add(btnClose);
            titleGrid.Children.Add(rightStack);

            return titleGrid;
        }

        private Border CreateTitleButton(string text, double fontSize, Action clickHandler, bool isClose = false, bool isDisabled = false)
        {
            var border = new Border
            {
                Width = 34,
                Height = 28,
                Background = Brushes.Transparent,
                CornerRadius = new CornerRadius(4),
                Cursor = isDisabled ? Cursors.Arrow : Cursors.Hand
            };

            var tb = new TextBlock
            {
                Text = text,
                FontSize = fontSize,
                Foreground = isDisabled
                    ? new SolidColorBrush((Color)ColorConverter.ConvertFromString("#483e60"))
                    : new SolidColorBrush((Color)ColorConverter.ConvertFromString("#8a80a8")),
                HorizontalAlignment = HorizontalAlignment.Center,
                VerticalAlignment = VerticalAlignment.Center
            };
            border.Child = tb;

            if (!isDisabled)
            {
                border.MouseEnter += (s, e) =>
                {
                    border.Background = isClose
                        ? new SolidColorBrush((Color)ColorConverter.ConvertFromString("#dc2626"))
                        : new SolidColorBrush((Color)ColorConverter.ConvertFromString("#291745"));
                    tb.Foreground = Brushes.White;
                };
                border.MouseLeave += (s, e) =>
                {
                    border.Background = Brushes.Transparent;
                    tb.Foreground = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#8a80a8"));
                };
                if (clickHandler != null)
                {
                    border.MouseLeftButtonDown += (s, e) => clickHandler();
                }
            }

            return border;
        }

        private Grid CreateWelcomeView()
        {
            var grid = new Grid { Margin = new Thickness(24, 12, 24, 14) };
            grid.RowDefinitions.Add(new RowDefinition { Height = new GridLength(1, GridUnitType.Star) }); // Top: Art & Texts
            grid.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto }); // Middle: Path & Browse row
            grid.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto }); // Bottom: Desktop Shortcut option

            // Top: Split into Left (Art) and Right (Text)
            var topGrid = new Grid();
            topGrid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(350) }); // Left Logo Art
            topGrid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) }); // Right Text

            // Left: 3D Emblem Logo
            var artSource = GetLeftArt();
            if (artSource != null)
            {
                var imgArt = new Image
                {
                    Source = artSource,
                    Stretch = Stretch.Uniform,
                    HorizontalAlignment = HorizontalAlignment.Center,
                    VerticalAlignment = VerticalAlignment.Center,
                    Margin = new Thickness(0, 0, 10, 0),
                    Effect = new DropShadowEffect
                    {
                        Color = (Color)ColorConverter.ConvertFromString("#9333ea"),
                        BlurRadius = 24,
                        ShadowDepth = 0,
                        Opacity = 0.5
                    }
                };
                Grid.SetColumn(imgArt, 0);
                topGrid.Children.Add(imgArt);
            }

            // Right: Headers & Description (Arabic RTL)
            var textStack = new StackPanel
            {
                VerticalAlignment = VerticalAlignment.Center,
                FlowDirection = FlowDirection.RightToLeft,
                Margin = new Thickness(10, 0, 0, 0)
            };

            textStack.Children.Add(new TextBlock
            {
                Text = "أهلاً بك في RaiZon Pro",
                FontSize = 26,
                FontWeight = FontWeights.Bold,
                Foreground = Brushes.White,
                Margin = new Thickness(0, 0, 0, 2)
            });

            textStack.Children.Add(new TextBlock
            {
                Text = "Setup Wizard",
                FontSize = 22,
                FontWeight = FontWeights.Bold,
                Foreground = Brushes.White,
                Margin = new Thickness(0, 0, 0, 18)
            });

            textStack.Children.Add(new TextBlock
            {
                Text = "أهلاً بك في RaiZon Pro سيستم كاشير\nكامل بتقارير احترافية.\nيرجى تحديد مكان التثبيت للنظام.",
                FontSize = 14,
                Foreground = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#b2a8d1")),
                LineHeight = 22,
                TextWrapping = TextWrapping.Wrap
            });

            Grid.SetColumn(textStack, 1);
            topGrid.Children.Add(textStack);

            Grid.SetRow(topGrid, 0);
            grid.Children.Add(topGrid);

            // Middle: Path & Browse row
            var middleGrid = new Grid { Margin = new Thickness(0, 14, 0, 4) };
            middleGrid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) }); // Path Box
            middleGrid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(14) }); // Spacer
            middleGrid.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto }); // Browse Button

            // Path Box
            var pathBorder = new Border
            {
                CornerRadius = new CornerRadius(10),
                Background = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#11091f")),
                BorderBrush = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#3d2166")),
                BorderThickness = new Thickness(1.2),
                Height = 44,
                FlowDirection = FlowDirection.LeftToRight
            };

            txtPath = new TextBox
            {
                Text = installDir,
                FontSize = 13.5,
                Padding = new Thickness(14, 10, 14, 10),
                Background = Brushes.Transparent,
                Foreground = Brushes.White,
                BorderThickness = new Thickness(0),
                VerticalAlignment = VerticalAlignment.Center
            };
            pathBorder.Child = txtPath;
            Grid.SetColumn(pathBorder, 0);
            middleGrid.Children.Add(pathBorder);

            // Browse Button
            var normalBrowseBg = new LinearGradientBrush(
                (Color)ColorConverter.ConvertFromString("#8b5cf6"),
                (Color)ColorConverter.ConvertFromString("#6d28d9"),
                new Point(0, 0),
                new Point(1, 0)
            );
            var hoverBrowseBg = new LinearGradientBrush(
                (Color)ColorConverter.ConvertFromString("#a855f7"),
                (Color)ColorConverter.ConvertFromString("#7c3aed"),
                new Point(0, 0),
                new Point(1, 0)
            );

            btnBrowseBorder = new Border
            {
                CornerRadius = new CornerRadius(10),
                Background = normalBrowseBg,
                BorderBrush = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#c084fc")),
                BorderThickness = new Thickness(1),
                Height = 44,
                Cursor = Cursors.Hand,
                Effect = new DropShadowEffect
                {
                    Color = (Color)ColorConverter.ConvertFromString("#a855f7"),
                    BlurRadius = 14,
                    ShadowDepth = 0,
                    Opacity = 0.65
                }
            };

            var browseTb = new TextBlock
            {
                Text = "تصفح...",
                FontSize = 14,
                FontWeight = FontWeights.Bold,
                Foreground = Brushes.White,
                VerticalAlignment = VerticalAlignment.Center,
                HorizontalAlignment = HorizontalAlignment.Center,
                Margin = new Thickness(28, 0, 28, 0)
            };
            btnBrowseBorder.Child = browseTb;

            btnBrowseBorder.MouseEnter += (s, e) =>
            {
                btnBrowseBorder.Background = hoverBrowseBg;
                btnBrowseBorder.BorderBrush = Brushes.White;
                browseTb.Foreground = Brushes.White;
            };
            btnBrowseBorder.MouseLeave += (s, e) =>
            {
                btnBrowseBorder.Background = normalBrowseBg;
                btnBrowseBorder.BorderBrush = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#c084fc"));
                browseTb.Foreground = Brushes.White;
            };
            btnBrowseBorder.MouseLeftButtonDown += (s, e) =>
            {
                var dlg = new System.Windows.Forms.FolderBrowserDialog
                {
                    Description = "اختر مجلد تثبيت RaiZon Pro",
                    SelectedPath = txtPath.Text
                };
                if (dlg.ShowDialog() == System.Windows.Forms.DialogResult.OK)
                {
                    txtPath.Text = Path.Combine(dlg.SelectedPath, "RaiZon Pro");
                }
            };

            Grid.SetColumn(btnBrowseBorder, 2);
            middleGrid.Children.Add(btnBrowseBorder);

            Grid.SetRow(middleGrid, 1);
            grid.Children.Add(middleGrid);

            // Row 2: Desktop Shortcut checkbox & button container
            var desktopRow = new Grid
            {
                Margin = new Thickness(4, 6, 4, 0),
                FlowDirection = FlowDirection.RightToLeft
            };
            desktopRow.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
            desktopRow.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });

            chkWelcomeDesktop = new CheckBox
            {
                Content = "إضافة اختصار لسطح المكتب (RaiZon Pro)",
                IsChecked = true,
                FontSize = 13.5,
                FontWeight = FontWeights.SemiBold,
                Foreground = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#d8b4fe")),
                Cursor = Cursors.Hand,
                VerticalAlignment = VerticalAlignment.Center
            };
            Grid.SetColumn(chkWelcomeDesktop, 0);
            desktopRow.Children.Add(chkWelcomeDesktop);

            Grid.SetRow(desktopRow, 2);
            grid.Children.Add(desktopRow);

            return grid;
        }

        private Grid CreateInstallingView()
        {
            var grid = new Grid
            {
                Margin = new Thickness(40, 20, 40, 20),
                VerticalAlignment = VerticalAlignment.Center,
                FlowDirection = FlowDirection.RightToLeft
            };
            grid.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
            grid.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
            grid.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
            grid.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });

            var title = new TextBlock
            {
                Text = "جاري تثبيت RaiZon Pro...",
                FontSize = 24,
                FontWeight = FontWeights.Bold,
                Foreground = Brushes.White,
                Margin = new Thickness(0, 0, 0, 10)
            };
            Grid.SetRow(title, 0);
            grid.Children.Add(title);

            var desc = new TextBlock
            {
                Text = "يرجى الانتظار بينما يقوم مساعد التثبيت بنسخ وإعداد الملفات على جهازك...",
                FontSize = 14,
                Foreground = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#aba5cc")),
                Margin = new Thickness(0, 0, 0, 24)
            };
            Grid.SetRow(desc, 1);
            grid.Children.Add(desc);

            var prgBorder = new Border
            {
                Height = 16,
                CornerRadius = new CornerRadius(8),
                Background = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#11091f")),
                BorderBrush = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#3d2166")),
                BorderThickness = new Thickness(1),
                ClipToBounds = true,
                Margin = new Thickness(0, 0, 0, 12)
            };

            prgBar = new ProgressBar
            {
                Height = 16,
                Minimum = 0,
                Maximum = 100,
                Value = 0,
                Background = Brushes.Transparent,
                BorderThickness = new Thickness(0),
                Foreground = new LinearGradientBrush(
                    (Color)ColorConverter.ConvertFromString("#8b5cf6"),
                    (Color)ColorConverter.ConvertFromString("#c084fc"),
                    new Point(0, 0),
                    new Point(1, 0)
                )
            };
            prgBorder.Child = prgBar;
            Grid.SetRow(prgBorder, 2);
            grid.Children.Add(prgBorder);

            var statusGrid = new Grid();
            statusGrid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
            statusGrid.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });

            lblStatus = new TextBlock
            {
                Text = "بدء عملية التثبيت...",
                FontSize = 13,
                Foreground = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#a59ecc"))
            };
            Grid.SetColumn(lblStatus, 0);
            statusGrid.Children.Add(lblStatus);

            lblPercent = new TextBlock
            {
                Text = "0%",
                FontSize = 13,
                FontWeight = FontWeights.Bold,
                Foreground = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#c084fc"))
            };
            Grid.SetColumn(lblPercent, 1);
            statusGrid.Children.Add(lblPercent);

            Grid.SetRow(statusGrid, 3);
            grid.Children.Add(statusGrid);

            return grid;
        }

        private Grid CreateCompletedView()
        {
            var grid = new Grid
            {
                Margin = new Thickness(40, 20, 40, 20),
                VerticalAlignment = VerticalAlignment.Center,
                FlowDirection = FlowDirection.RightToLeft
            };
            grid.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
            grid.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
            grid.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
            grid.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });

            var title = new TextBlock
            {
                Text = "اكتمل تثبيت RaiZon Pro بنجاح! 🎉",
                FontSize = 24,
                FontWeight = FontWeights.Bold,
                Foreground = Brushes.White,
                Margin = new Thickness(0, 0, 0, 10)
            };
            Grid.SetRow(title, 0);
            grid.Children.Add(title);

            var desc = new TextBlock
            {
                Text = "تم تثبيت نظام الكاشير وأداة الباتشر بنجاح على جهازك وهو جاهز للتشغيل الآن.",
                FontSize = 14,
                Foreground = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#aba5cc")),
                Margin = new Thickness(0, 0, 0, 24)
            };
            Grid.SetRow(desc, 1);
            grid.Children.Add(desc);

            chkLaunch = new CheckBox
            {
                Content = "تشغيل RaiZon Pro الآن",
                IsChecked = true,
                FontSize = 14,
                Foreground = Brushes.White,
                Margin = new Thickness(0, 0, 0, 12),
                Cursor = Cursors.Hand
            };
            Grid.SetRow(chkLaunch, 2);
            grid.Children.Add(chkLaunch);

            chkDesktopShortcut = new CheckBox
            {
                Content = "إنشاء اختصارات سطح المكتب (RaiZon Pro و Patcher)",
                IsChecked = (chkWelcomeDesktop == null || chkWelcomeDesktop.IsChecked == true),
                FontSize = 14,
                Foreground = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#d0c9ed")),
                Margin = new Thickness(0, 0, 0, 14),
                Cursor = Cursors.Hand
            };
            Grid.SetRow(chkDesktopShortcut, 3);
            grid.Children.Add(chkDesktopShortcut);

            grid.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });

            var btnCreateDesktopNow = new Border
            {
                CornerRadius = new CornerRadius(9),
                Background = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#1c112e")),
                BorderBrush = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#7c3aed")),
                BorderThickness = new Thickness(1),
                Padding = new Thickness(16, 8, 16, 8),
                HorizontalAlignment = HorizontalAlignment.Right,
                Cursor = Cursors.Hand,
                Margin = new Thickness(0, 0, 0, 10)
            };
            var btnCreateDesktopNowText = new TextBlock
            {
                Text = "🖥️ إضافة اختصار لسطح المكتب الآن",
                FontSize = 13,
                FontWeight = FontWeights.Bold,
                Foreground = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#e9d5ff"))
            };
            btnCreateDesktopNow.Child = btnCreateDesktopNowText;
            btnCreateDesktopNow.MouseEnter += (s, e) =>
            {
                btnCreateDesktopNow.Background = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#2d1748"));
                btnCreateDesktopNow.BorderBrush = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#a855f7"));
            };
            btnCreateDesktopNow.MouseLeave += (s, e) =>
            {
                btnCreateDesktopNow.Background = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#1c112e"));
                btnCreateDesktopNow.BorderBrush = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#7c3aed"));
            };
            btnCreateDesktopNow.MouseLeftButtonDown += (s, e) =>
            {
                CreateShortcuts(txtPath.Text);
                btnCreateDesktopNowText.Text = "✓ تم إنشاء اختصار سطح المكتب بنجاح!";
                btnCreateDesktopNow.BorderBrush = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#22c55e"));
                btnCreateDesktopNowText.Foreground = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#4ade80"));
            };
            Grid.SetRow(btnCreateDesktopNow, 4);
            grid.Children.Add(btnCreateDesktopNow);

            return grid;
        }

        private Border CreateFooterBar()
        {
            var footerBorder = new Border
            {
                Background = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#0b0615")),
                BorderBrush = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#24133d")),
                BorderThickness = new Thickness(0, 1.2, 0, 0),
                CornerRadius = new CornerRadius(0, 0, 13, 13),
                Padding = new Thickness(24, 0, 24, 0)
            };

            var barGrid = new Grid();

            // 1. Left: Cancel Button (triggers confirmation modal)
            var normalCancelBg = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#1c112e"));
            var hoverCancelBg = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#2d1748"));

            btnCancelBorder = new Border
            {
                HorizontalAlignment = HorizontalAlignment.Left,
                VerticalAlignment = VerticalAlignment.Center,
                CornerRadius = new CornerRadius(10),
                Background = normalCancelBg,
                BorderBrush = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#522480")),
                BorderThickness = new Thickness(1),
                Cursor = Cursors.Hand
            };

            var cancelTb = new TextBlock
            {
                Text = "إلغاء الأمر",
                FontSize = 13.5,
                FontWeight = FontWeights.SemiBold,
                Foreground = Brushes.White,
                Margin = new Thickness(24, 8, 24, 8)
            };
            btnCancelBorder.Child = cancelTb;

            btnCancelBorder.MouseEnter += (s, e) =>
            {
                btnCancelBorder.Background = hoverCancelBg;
                btnCancelBorder.BorderBrush = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#8b5cf6"));
                cancelTb.Foreground = Brushes.White;
            };
            btnCancelBorder.MouseLeave += (s, e) =>
            {
                btnCancelBorder.Background = normalCancelBg;
                btnCancelBorder.BorderBrush = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#522480"));
                cancelTb.Foreground = Brushes.White;
            };
            btnCancelBorder.MouseLeftButtonDown += (s, e) => ShowConfirmModal();
            barGrid.Children.Add(btnCancelBorder);

            // 2. Right: Back and Next buttons
            var rightStack = new StackPanel
            {
                Orientation = Orientation.Horizontal,
                HorizontalAlignment = HorizontalAlignment.Right,
                VerticalAlignment = VerticalAlignment.Center
            };

            // Back button (< السابق)
            btnBackBorder = new Border
            {
                CornerRadius = new CornerRadius(10),
                Background = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#140c21")),
                BorderBrush = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#24143a")),
                BorderThickness = new Thickness(1),
                Margin = new Thickness(0, 0, 12, 0),
                Cursor = Cursors.Arrow
            };

            btnBackText = new TextBlock
            {
                Text = "< السابق",
                FontSize = 13.5,
                FontWeight = FontWeights.Normal,
                Foreground = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#504468")),
                Margin = new Thickness(22, 8, 22, 8)
            };
            btnBackBorder.Child = btnBackText;
            rightStack.Children.Add(btnBackBorder);

            // Next button (التالي >)
            var normalNextBg = new LinearGradientBrush(
                (Color)ColorConverter.ConvertFromString("#8b5cf6"),
                (Color)ColorConverter.ConvertFromString("#6d28d9"),
                new Point(0, 0),
                new Point(1, 0)
            );
            var hoverNextBg = new LinearGradientBrush(
                (Color)ColorConverter.ConvertFromString("#9d71f7"),
                (Color)ColorConverter.ConvertFromString("#7c3aed"),
                new Point(0, 0),
                new Point(1, 0)
            );

            btnNextBorder = new Border
            {
                CornerRadius = new CornerRadius(10),
                Background = normalNextBg,
                BorderBrush = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#c084fc")),
                BorderThickness = new Thickness(1),
                Cursor = Cursors.Hand,
                Effect = new DropShadowEffect
                {
                    Color = (Color)ColorConverter.ConvertFromString("#a855f7"),
                    BlurRadius = 16,
                    ShadowDepth = 0,
                    Opacity = 0.75
                }
            };

            btnNextText = new TextBlock
            {
                Text = "التالي >",
                FontSize = 14,
                FontWeight = FontWeights.Bold,
                Foreground = Brushes.White,
                Margin = new Thickness(32, 8, 32, 8)
            };
            btnNextBorder.Child = btnNextText;

            btnNextBorder.MouseEnter += (s, e) =>
            {
                btnNextBorder.Background = hoverNextBg;
                btnNextBorder.BorderBrush = Brushes.White;
                btnNextText.Foreground = Brushes.White;
            };
            btnNextBorder.MouseLeave += (s, e) =>
            {
                btnNextBorder.Background = normalNextBg;
                btnNextBorder.BorderBrush = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#c084fc"));
                btnNextText.Foreground = Brushes.White;
            };
            btnNextBorder.MouseLeftButtonDown += (s, e) => HandleNextClick();

            rightStack.Children.Add(btnNextBorder);

            barGrid.Children.Add(rightStack);
            footerBorder.Child = barGrid;
            return footerBorder;
        }

        // =========================================================================
        // نافذة تأكيد الإغلاق المخصصة (بنفس الثيم البنفسجي الفاخر والمتوهج)
        // =========================================================================
        private Grid CreateConfirmModal()
        {
            var overlay = new Grid
            {
                Background = new SolidColorBrush(Color.FromArgb(200, 7, 3, 14)), // Dark translucent backdrop
                FlowDirection = FlowDirection.RightToLeft
            };

            var cardBorder = new Border
            {
                Width = 440,
                VerticalAlignment = VerticalAlignment.Center,
                HorizontalAlignment = HorizontalAlignment.Center,
                CornerRadius = new CornerRadius(16),
                BorderThickness = new Thickness(1.5),
                BorderBrush = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#a855f7")),
                Background = new LinearGradientBrush(
                    (Color)ColorConverter.ConvertFromString("#1b0f33"),
                    (Color)ColorConverter.ConvertFromString("#100820"),
                    new Point(0, 0),
                    new Point(0, 1)
                ),
                Effect = new DropShadowEffect
                {
                    Color = (Color)ColorConverter.ConvertFromString("#a855f7"),
                    BlurRadius = 36,
                    ShadowDepth = 0,
                    Opacity = 0.7
                },
                Padding = new Thickness(24, 22, 24, 22)
            };

            var stack = new StackPanel();

            // Header Row: Icon + Title
            var headerRow = new StackPanel
            {
                Orientation = Orientation.Horizontal,
                Margin = new Thickness(0, 0, 0, 12)
            };

            var iconBorder = new Border
            {
                Width = 36,
                Height = 36,
                CornerRadius = new CornerRadius(18),
                Background = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#2e1329")),
                BorderBrush = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#ef4444")),
                BorderThickness = new Thickness(1),
                Margin = new Thickness(0, 0, 12, 0)
            };
            var iconTb = new TextBlock
            {
                Text = "✕",
                FontSize = 16,
                FontWeight = FontWeights.Bold,
                Foreground = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#f87171")),
                HorizontalAlignment = HorizontalAlignment.Center,
                VerticalAlignment = VerticalAlignment.Center
            };
            iconBorder.Child = iconTb;
            headerRow.Children.Add(iconBorder);

            var titleTb = new TextBlock
            {
                Text = "تأكيد إلغاء التثبيت",
                FontSize = 18,
                FontWeight = FontWeights.Bold,
                Foreground = Brushes.White,
                VerticalAlignment = VerticalAlignment.Center
            };
            headerRow.Children.Add(titleTb);

            stack.Children.Add(headerRow);

            // Message text
            var msgTb = new TextBlock
            {
                Text = "هل أنت متأكد من رغبتك في إلغاء عملية التثبيت والخروج؟\nلن يتم تثبيت أو تعديل أي ملفات على نظامك.",
                FontSize = 13.5,
                Foreground = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#c9c2e3")),
                LineHeight = 22,
                Margin = new Thickness(0, 0, 0, 24),
                TextWrapping = TextWrapping.Wrap
            };
            stack.Children.Add(msgTb);

            // Buttons Row (Yes Exit & Continue Setup)
            var btnRow = new StackPanel
            {
                Orientation = Orientation.Horizontal,
                HorizontalAlignment = HorizontalAlignment.Left
            };

            // Continue Setup Button (متابعة التثبيت - Primary glowing purple)
            var normalContBg = new LinearGradientBrush(
                (Color)ColorConverter.ConvertFromString("#8b5cf6"),
                (Color)ColorConverter.ConvertFromString("#6d28d9"),
                new Point(0, 0),
                new Point(1, 0)
            );
            var hoverContBg = new LinearGradientBrush(
                (Color)ColorConverter.ConvertFromString("#9d71f7"),
                (Color)ColorConverter.ConvertFromString("#7c3aed"),
                new Point(0, 0),
                new Point(1, 0)
            );

            var btnContinueBorder = new Border
            {
                CornerRadius = new CornerRadius(10),
                Background = normalContBg,
                BorderBrush = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#c084fc")),
                BorderThickness = new Thickness(1),
                Margin = new Thickness(0, 0, 12, 0),
                Cursor = Cursors.Hand,
                Effect = new DropShadowEffect
                {
                    Color = (Color)ColorConverter.ConvertFromString("#a855f7"),
                    BlurRadius = 14,
                    ShadowDepth = 0,
                    Opacity = 0.7
                }
            };
            var continueTb = new TextBlock
            {
                Text = "متابعة التثبيت",
                FontSize = 13.5,
                FontWeight = FontWeights.Bold,
                Foreground = Brushes.White,
                Margin = new Thickness(24, 8, 24, 8)
            };
            btnContinueBorder.Child = continueTb;

            btnContinueBorder.MouseEnter += (s, e) =>
            {
                btnContinueBorder.Background = hoverContBg;
                btnContinueBorder.BorderBrush = Brushes.White;
            };
            btnContinueBorder.MouseLeave += (s, e) =>
            {
                btnContinueBorder.Background = normalContBg;
                btnContinueBorder.BorderBrush = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#c084fc"));
            };
            btnContinueBorder.MouseLeftButtonDown += (s, e) => HideConfirmModal();
            btnRow.Children.Add(btnContinueBorder);

            // Exit Button (نعم، إلغاء وخروج - Red pill button)
            var normalExitBg = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#2a121e"));
            var hoverExitBg = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#3d1828"));

            var btnExitBorder = new Border
            {
                CornerRadius = new CornerRadius(10),
                Background = normalExitBg,
                BorderBrush = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#ef4444")),
                BorderThickness = new Thickness(1),
                Cursor = Cursors.Hand
            };
            var exitTb = new TextBlock
            {
                Text = "نعم، إلغاء وخروج",
                FontSize = 13.5,
                FontWeight = FontWeights.SemiBold,
                Foreground = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#fca5a5")),
                Margin = new Thickness(20, 8, 20, 8)
            };
            btnExitBorder.Child = exitTb;

            btnExitBorder.MouseEnter += (s, e) =>
            {
                btnExitBorder.Background = hoverExitBg;
                btnExitBorder.BorderBrush = Brushes.White;
                exitTb.Foreground = Brushes.White;
            };
            btnExitBorder.MouseLeave += (s, e) =>
            {
                btnExitBorder.Background = normalExitBg;
                btnExitBorder.BorderBrush = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#ef4444"));
                exitTb.Foreground = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#fca5a5"));
            };
            btnExitBorder.MouseLeftButtonDown += (s, e) =>
            {
                isConfirmedExit = true;
                Close();
            };
            btnRow.Children.Add(btnExitBorder);

            stack.Children.Add(btnRow);

            cardBorder.Child = stack;
            overlay.Children.Add(cardBorder);

            return overlay;
        }

        private void ShowConfirmModal()
        {
            if (modalOverlay != null)
            {
                modalOverlay.Visibility = Visibility.Visible;
            }
        }

        private void HideConfirmModal()
        {
            if (modalOverlay != null)
            {
                modalOverlay.Visibility = Visibility.Collapsed;
            }
        }

        private async void HandleNextClick()
        {
            if (viewWelcome.Visibility == Visibility.Visible)
            {
                installDir = txtPath.Text.Trim();
                if (string.IsNullOrEmpty(installDir))
                {
                    MessageBox.Show("يرجى إدخال مسار التثبيت الصحيح.", "تنبيه", MessageBoxButton.OK, MessageBoxImage.Warning);
                    return;
                }

                viewWelcome.Visibility = Visibility.Collapsed;
                viewInstalling.Visibility = Visibility.Visible;
                btnNextBorder.Visibility = Visibility.Collapsed;
                btnBackBorder.Visibility = Visibility.Collapsed;
                btnCancelBorder.Visibility = Visibility.Collapsed;

                await Task.Run(() => PerformInstallation(installDir));

                viewInstalling.Visibility = Visibility.Collapsed;
                viewCompleted.Visibility = Visibility.Visible;
                btnNextText.Text = "إنهاء";
                btnNextBorder.Visibility = Visibility.Visible;
            }
            else if (viewCompleted.Visibility == Visibility.Visible)
            {
                if (chkLaunch.IsChecked == true)
                {
                    string mainExe = Path.Combine(installDir, "RaiZon Pro.exe");
                    if (File.Exists(mainExe))
                    {
                        try
                        {
                            System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo
                            {
                                FileName = mainExe,
                                WorkingDirectory = installDir
                            });
                        }
                        catch { }
                    }
                }
                isConfirmedExit = true;
                Close();
            }
        }

        private void PerformInstallation(string targetDir)
        {
            try
            {
                Directory.CreateDirectory(targetDir);

                var asm = Assembly.GetExecutingAssembly();
                using (var stream = asm.GetManifestResourceStream("AppPayload"))
                {
                    if (stream != null)
                    {
                        using (var zip = new ZipArchive(stream, ZipArchiveMode.Read))
                        {
                            int total = zip.Entries.Count;
                            int current = 0;

                            foreach (var entry in zip.Entries)
                            {
                                current++;
                                int percent = (int)((current / (double)total) * 100);

                                string destFile = Path.Combine(targetDir, entry.FullName);
                                string destFolder = Path.GetDirectoryName(destFile);

                                if (!string.IsNullOrEmpty(destFolder))
                                    Directory.CreateDirectory(destFolder);

                                if (!string.IsNullOrEmpty(entry.Name))
                                {
                                    entry.ExtractToFile(destFile, true);
                                }

                                Dispatcher.Invoke(() =>
                                {
                                    prgBar.Value = percent;
                                    lblPercent.Text = percent + "%";
                                    lblStatus.Text = "جاري استخراج: " + entry.Name;
                                });

                                Thread.Sleep(8);
                            }
                        }
                    }
                }

                Dispatcher.Invoke(() =>
                {
                    lblStatus.Text = "جاري إنشاء الاختصارات وتسجيل البرنامج في النظام...";
                    prgBar.Value = 98;
                    lblPercent.Text = "98%";
                });

                CreateShortcuts(targetDir);
                RegisterUninstaller(targetDir);

                Dispatcher.Invoke(() =>
                {
                    prgBar.Value = 100;
                    lblPercent.Text = "100%";
                    lblStatus.Text = "تم الانتهاء من التثبيت بنجاح.";
                });

                Thread.Sleep(300);
            }
            catch (Exception ex)
            {
                Dispatcher.Invoke(() =>
                {
                    MessageBox.Show("حدث خطأ أثناء التثبيت:\n" + ex.Message, "خطأ", MessageBoxButton.OK, MessageBoxImage.Error);
                });
            }
        }

        public static void CreateShortcutsStatic(string targetDir)
        {
            try
            {
                string desktopPath = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
                string startMenuPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Programs), "RaiZon Pro");
                Directory.CreateDirectory(startMenuPath);

                string mainExe = Path.Combine(targetDir, "RaiZon Pro.exe");
                string patcherExe = Path.Combine(targetDir, "Patcher.exe");

                Type shellType = Type.GetTypeFromProgID("WScript.Shell");
                if (shellType != null)
                {
                    dynamic shell = Activator.CreateInstance(shellType);
                    dynamic lnkApp = shell.CreateShortcut(Path.Combine(desktopPath, "RaiZon Pro.lnk"));
                    lnkApp.TargetPath = mainExe;
                    lnkApp.WorkingDirectory = targetDir;
                    lnkApp.Description = "RaiZon Pro - نظام الكاشير المتكامل";
                    lnkApp.Save();

                    if (File.Exists(patcherExe))
                    {
                        dynamic lnkPatcher = shell.CreateShortcut(Path.Combine(desktopPath, "Patcher.lnk"));
                        lnkPatcher.TargetPath = patcherExe;
                        lnkPatcher.WorkingDirectory = targetDir;
                        lnkPatcher.Description = "أداة تفعيل وتراخيص RaiZon Pro";
                        lnkPatcher.Save();
                    }

                    dynamic lnkStartApp = shell.CreateShortcut(Path.Combine(startMenuPath, "RaiZon Pro.lnk"));
                    lnkStartApp.TargetPath = mainExe;
                    lnkStartApp.WorkingDirectory = targetDir;
                    lnkStartApp.Save();

                    if (File.Exists(patcherExe))
                    {
                        dynamic lnkStartPatcher = shell.CreateShortcut(Path.Combine(startMenuPath, "Patcher.lnk"));
                        lnkStartPatcher.TargetPath = patcherExe;
                        lnkStartPatcher.WorkingDirectory = targetDir;
                        lnkStartPatcher.Save();
                    }
                }
            }
            catch { }
        }

        public static void RegisterUninstallerStatic(string targetDir)
        {
            try
            {
                string mainExe = Path.Combine(targetDir, "RaiZon Pro.exe");
                string iconPath = Path.Combine(targetDir, "resources", "icon.ico");
                if (!File.Exists(iconPath)) iconPath = mainExe;

                using (var key = Registry.CurrentUser.CreateSubKey(@"Software\Microsoft\Windows\CurrentVersion\Uninstall\RaiZonPro"))
                {
                    if (key != null)
                    {
                        key.SetValue("DisplayName", "RaiZon Pro");
                        key.SetValue("DisplayVersion", "1.0.0");
                        key.SetValue("Publisher", "Eng. Abdelrahman Fathy El-Adly");
                        key.SetValue("DisplayIcon", iconPath);
                        key.SetValue("InstallLocation", targetDir);
                        key.SetValue("UninstallString", "cmd.exe /c rd /s /q \"" + targetDir + "\"");
                    }
                }
            }
            catch { }
        }

        private void CreateShortcuts(string targetDir)
        {
            try
            {
                string desktopPath = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
                string startMenuPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Programs), "RaiZon Pro");
                Directory.CreateDirectory(startMenuPath);

                string mainExe = Path.Combine(targetDir, "RaiZon Pro.exe");
                string patcherExe = Path.Combine(targetDir, "Patcher.exe");

                Type shellType = Type.GetTypeFromProgID("WScript.Shell");
                if (shellType != null)
                {
                    dynamic shell = Activator.CreateInstance(shellType);

                    bool createDesktop = (chkWelcomeDesktop == null || chkWelcomeDesktop.IsChecked == true) &&
                                        (chkDesktopShortcut == null || chkDesktopShortcut.IsChecked == true);
                    if (createDesktop)
                    {
                        dynamic lnkApp = shell.CreateShortcut(Path.Combine(desktopPath, "RaiZon Pro.lnk"));
                        lnkApp.TargetPath = mainExe;
                        lnkApp.WorkingDirectory = targetDir;
                        lnkApp.Description = "RaiZon Pro - نظام الكاشير المتكامل";
                        lnkApp.Save();

                        if (File.Exists(patcherExe))
                        {
                            dynamic lnkPatcher = shell.CreateShortcut(Path.Combine(desktopPath, "Patcher.lnk"));
                            lnkPatcher.TargetPath = patcherExe;
                            lnkPatcher.WorkingDirectory = targetDir;
                            lnkPatcher.Description = "أداة تفعيل وتراخيص RaiZon Pro";
                            lnkPatcher.Save();
                        }
                    }

                    dynamic lnkStartApp = shell.CreateShortcut(Path.Combine(startMenuPath, "RaiZon Pro.lnk"));
                    lnkStartApp.TargetPath = mainExe;
                    lnkStartApp.WorkingDirectory = targetDir;
                    lnkStartApp.Save();

                    if (File.Exists(patcherExe))
                    {
                        dynamic lnkStartPatcher = shell.CreateShortcut(Path.Combine(startMenuPath, "Patcher.lnk"));
                        lnkStartPatcher.TargetPath = patcherExe;
                        lnkStartPatcher.WorkingDirectory = targetDir;
                        lnkStartPatcher.Save();
                    }
                }
            }
            catch { }
        }

        private void RegisterUninstaller(string targetDir)
        {
            try
            {
                string mainExe = Path.Combine(targetDir, "RaiZon Pro.exe");
                string iconPath = Path.Combine(targetDir, "resources", "icon.ico");
                if (!File.Exists(iconPath)) iconPath = mainExe;

                using (var key = Registry.CurrentUser.CreateSubKey(@"Software\Microsoft\Windows\CurrentVersion\Uninstall\RaiZonPro"))
                {
                    if (key != null)
                    {
                        key.SetValue("DisplayName", "RaiZon Pro");
                        key.SetValue("DisplayVersion", "1.0.0");
                        key.SetValue("Publisher", "Eng. Abdelrahman Fathy El-Adly");
                        key.SetValue("DisplayIcon", iconPath);
                        key.SetValue("InstallLocation", targetDir);
                        key.SetValue("UninstallString", "cmd.exe /c rd /s /q \"" + targetDir + "\"");
                    }
                }
            }
            catch { }
        }

                public static string DetectExistingInstallDir(string[] args)
        {
            // 1. فحص وسائط سطر الأوامر الممررة من التطبيق الحالي
            if (args != null && args.Length > 0)
            {
                foreach (var a in args)
                {
                    if (string.IsNullOrWhiteSpace(a)) continue;
                    string trimmed = a.Trim().Trim('"');
                    if (trimmed.StartsWith("--dir=", StringComparison.OrdinalIgnoreCase))
                        return trimmed.Substring(6).Trim().Trim('"');
                    if (trimmed.StartsWith("/dir=", StringComparison.OrdinalIgnoreCase))
                        return trimmed.Substring(5).Trim().Trim('"');
                    if (trimmed.StartsWith("--target=", StringComparison.OrdinalIgnoreCase))
                        return trimmed.Substring(9).Trim().Trim('"');
                    if (trimmed.StartsWith("/d=", StringComparison.OrdinalIgnoreCase))
                        return trimmed.Substring(3).Trim().Trim('"');
                    if (trimmed.StartsWith("/D=", StringComparison.OrdinalIgnoreCase))
                        return trimmed.Substring(3).Trim().Trim('"');
                    if (Directory.Exists(trimmed) && (File.Exists(Path.Combine(trimmed, "RaiZon Pro.exe")) || File.Exists(Path.Combine(trimmed, "resources", "procashier-server.exe"))))
                        return trimmed;
                }
            }

            // 2. فحص مسار مجلد برنامج RaiZon Pro المشغل حالياً
            try
            {
                var procs = Process.GetProcessesByName("RaiZon Pro");
                if (procs != null && procs.Length > 0)
                {
                    foreach (var p in procs)
                    {
                        try
                        {
                            string pPath = (p.MainModule != null) ? p.MainModule.FileName : null;
                            if (!string.IsNullOrEmpty(pPath) && File.Exists(pPath))
                            {
                                string dir = Path.GetDirectoryName(pPath);
                                if (!string.IsNullOrEmpty(dir) && Directory.Exists(dir))
                                    return dir;
                            }
                        }
                        catch { }
                    }
                }
            }
            catch { }

            // 3. فحص سجل وندوز (HKCU) لآخر مسار تثبيت مسجل
            try
            {
                using (var key = Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Uninstall\RaiZonPro"))
                {
                    if (key != null)
                    {
                        object loc = key.GetValue("InstallLocation");
                        if (loc != null && !string.IsNullOrWhiteSpace(loc.ToString()) && Directory.Exists(loc.ToString()))
                        {
                            return loc.ToString().Trim();
                        }
                    }
                }
            }
            catch { }

            // 4. فحص سجل وندوز (HKLM)
            try
            {
                using (var key = Registry.LocalMachine.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Uninstall\RaiZonPro"))
                {
                    if (key != null)
                    {
                        object loc = key.GetValue("InstallLocation");
                        if (loc != null && !string.IsNullOrWhiteSpace(loc.ToString()) && Directory.Exists(loc.ToString()))
                        {
                            return loc.ToString().Trim();
                        }
                    }
                }
            }
            catch { }

            return null;
        }

        private ImageSource GetAppIcon()
        {
            try
            {
                var asm = Assembly.GetExecutingAssembly();
                using (var s = asm.GetManifestResourceStream("AppIcon"))
                {
                    if (s != null)
                    {
                        var bitmap = new BitmapImage();
                        bitmap.BeginInit();
                        bitmap.StreamSource = s;
                        bitmap.CacheOption = BitmapCacheOption.OnLoad;
                        bitmap.EndInit();
                        return bitmap;
                    }
                }
            }
            catch { }
            return null;
        }

        private ImageSource GetLeftArt()
        {
            try
            {
                var asm = Assembly.GetExecutingAssembly();
                using (var s = asm.GetManifestResourceStream("LeftArt"))
                {
                    if (s != null)
                    {
                        var bitmap = new BitmapImage();
                        bitmap.BeginInit();
                        bitmap.StreamSource = s;
                        bitmap.CacheOption = BitmapCacheOption.OnLoad;
                        bitmap.EndInit();
                        return bitmap;
                    }
                }
            }
            catch { }
            return null;
        }
    }
}
