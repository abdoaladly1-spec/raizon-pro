with open('server/main.py', 'r', encoding='utf-8') as f:
    text = f.read()

helper_code = '''def apply_email_config_from_payload(payload: Dict[str, Any]):
    """استرجاع بريد المدير وإعدادات الإشعارات من النسخة الاحتياطية وتفعيلها فوراً."""
    import config
    if not isinstance(payload, dict):
        return
    cfg = payload.get("emailConfig") or payload.get("settings", {}).get("emailConfig") or {}
    email_to = cfg.get("emailTo") or cfg.get("email_to") or payload.get("managerEmail") or payload.get("settings", {}).get("managerEmail") or ""
    
    if email_to:
        config.EMAIL_TO = str(email_to).strip()
        if "notifyOnInvoice" in cfg:
            config.NOTIFY_ON_INVOICE = bool(cfg["notifyOnInvoice"])
        elif "notify_on_invoice" in cfg:
            config.NOTIFY_ON_INVOICE = bool(cfg["notify_on_invoice"])
            
        if "notifyOnClosing" in cfg:
            config.NOTIFY_ON_CLOSING = bool(cfg["notifyOnClosing"])
        elif "notify_on_closing" in cfg:
            config.NOTIFY_ON_CLOSING = bool(cfg["notify_on_closing"])

        if "notifyOnReturn" in cfg:
            config.NOTIFY_ON_RETURN = bool(cfg["notifyOnReturn"])
        elif "notify_on_return" in cfg:
            config.NOTIFY_ON_RETURN = bool(cfg["notify_on_return"])

        if "notifyOnExpense" in cfg:
            config.NOTIFY_ON_EXPENSE = bool(cfg["notifyOnExpense"])
        elif "notify_on_expense" in cfg:
            config.NOTIFY_ON_EXPENSE = bool(cfg["notify_on_expense"])

        config.EMAIL_MODE = "auto"

        # حفظ دائم في server.env
        try:
            env_file = config.ENV_FILE
            raw = env_file.read_text(encoding="utf-8") if env_file.exists() else ""
            settings_dict = {}
            for line in raw.splitlines():
                if "=" in line and not line.strip().startswith("#"):
                    k, _, v = line.partition("=")
                    settings_dict[k.strip()] = v.strip()
            settings_dict["EMAIL_TO"] = config.EMAIL_TO
            settings_dict["NOTIFY_ON_INVOICE"] = "true" if config.NOTIFY_ON_INVOICE else "false"
            settings_dict["NOTIFY_ON_CLOSING"] = "true" if config.NOTIFY_ON_CLOSING else "false"
            settings_dict["NOTIFY_ON_RETURN"] = "true" if config.NOTIFY_ON_RETURN else "false"
            settings_dict["NOTIFY_ON_EXPENSE"] = "true" if config.NOTIFY_ON_EXPENSE else "false"
            settings_dict["EMAIL_MODE"] = "auto"
            lines = [f"{k}={v}" for k, v in settings_dict.items()]
            env_file.write_text("\\n".join(lines) + "\\n", encoding="utf-8")
            print(f"[RESTORE] Manager email restored successfully: {config.EMAIL_TO}")
        except Exception as e:
            print(f"[RESTORE][ERROR] Failed to write env_file: {e}")

'''

# Insert helper before save_backup
backup_section_target = "# ------------------------------------------------------------------ Backup (نسخ احتياطي محلي وسحابي)"
text = text.replace(backup_section_target, helper_code + backup_section_target, 1)

# In save_backup, ensure email is embedded in payload
save_backup_target = """        BACKUP_DIR.mkdir(parents=True, exist_ok=True)
        data = json.dumps(payload, ensure_ascii=False, indent=2)"""

save_backup_replacement = """        BACKUP_DIR.mkdir(parents=True, exist_ok=True)
        
        # إدراج بريد المدير وإعدادات الإشعارات ضمن النسخة الاحتياطية
        email_info = {
            "emailTo": config.EMAIL_TO or "",
            "notifyOnInvoice": getattr(config, "NOTIFY_ON_INVOICE", True),
            "notifyOnClosing": getattr(config, "NOTIFY_ON_CLOSING", True),
            "notifyOnReturn": getattr(config, "NOTIFY_ON_RETURN", True),
            "notifyOnExpense": getattr(config, "NOTIFY_ON_EXPENSE", True),
            "smtpUser": config.SMTP_USER or "rizon.pro.app@gmail.com"
        }
        if isinstance(payload, dict):
            client_email = (payload.get("settings", {}) or {}).get("emailConfig", {}).get("emailTo") or (payload.get("settings", {}) or {}).get("managerEmail") or payload.get("managerEmail")
            if client_email:
                email_info["emailTo"] = str(client_email).strip()
                config.EMAIL_TO = email_info["emailTo"]
            if "settings" in payload and isinstance(payload["settings"], dict):
                payload["settings"]["emailConfig"] = email_info
                payload["settings"]["managerEmail"] = email_info["emailTo"]
            payload["emailConfig"] = email_info
            payload["managerEmail"] = email_info["emailTo"]

        data = json.dumps(payload, ensure_ascii=False, indent=2)"""

text = text.replace(save_backup_target, save_backup_replacement, 1)

# In restore_backup_by_filename, call apply_email_config_from_payload
restore_target = """        state = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:"""

restore_replacement = """        state = json.loads(path.read_text(encoding="utf-8"))
        apply_email_config_from_payload(state)
    except Exception as exc:"""

text = text.replace(restore_target, restore_replacement, 1)

with open('server/main.py', 'w', encoding='utf-8') as f:
    f.write(text)

print('Updated server/main.py successfully')
