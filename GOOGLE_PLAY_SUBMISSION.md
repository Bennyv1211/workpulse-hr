# PeopleFlow HR - Google Play Store Submission Guide

## 📱 App Information

| Property | Value |
|----------|-------|
| **App Name** | PeopleFlow HR |
| **Package Name** | `com.peopleflow.hr` |
| **Version Name** | 1.0.0 |
| **Version Code** | 1 |

---

## 🔐 CRITICAL: Keystore Credentials (SAVE SECURELY!)

⚠️ **IMPORTANT: Keep these credentials safe! You'll need them for all future app updates.**

| Credential | Value |
|------------|-------|
| **Keystore File** | `android/app/peopleflow-release.keystore` |
| **Key Alias** | `peopleflow-hr-release-key` |
| **Keystore Password** | `PeopleFlow2025Secure!` |
| **Key Password** | `PeopleFlow2025Secure!` |

### Certificate Fingerprints
- **SHA-1**: `BB:2D:EE:A7:C7:8D:FC:EC:BC:ED:23:8C:39:3E:7D:C9:50:A3:91:EF`
- **SHA-256**: `3A:C7:49:09:32:BA:B8:7A:E9:23:95:A0:CD:D5:F9:27:B2:F3:39:32:3D:37:8E:72:65:63:79:72:3D:88:70:82`

---

## 📁 Files to Download and Save

Download these files from the project and store them securely:

1. **`/app/frontend/android/app/peopleflow-release.keystore`**
   - This is your signing keystore
   - **CRITICAL**: Back this up! Losing it means you can't update your app
   
2. **`/app/frontend/credentials.json`**
   - Contains the keystore configuration for EAS Build
   - Keep this private and secure

3. **`/app/frontend/app.json`**
   - App configuration with package name and version

4. **`/app/frontend/eas.json`**
   - EAS Build configuration

---

## 🚀 Building the App Bundle (.aab)

### Option 1: Using EAS Build (Recommended)

1. **Login to Expo:**
   ```bash
   cd /app/frontend
   npx eas-cli login
   ```

2. **Configure your project ID:**
   ```bash
   npx eas-cli init
   ```

3. **Build the production AAB:**
   ```bash
   npx eas-cli build --platform android --profile production
   ```

4. **Download the .aab file** from the Expo dashboard or build output.

### Option 2: Local Build (Advanced)

If you want to build locally:

1. **Generate native Android project:**
   ```bash
   npx expo prebuild --platform android
   ```

2. **Build using Gradle:**
   ```bash
   cd android
   ./gradlew bundleRelease
   ```

3. **Find the AAB at:**
   ```
   android/app/build/outputs/bundle/release/app-release.aab
   ```

---

## 📋 Google Play Console Submission Checklist

### Before Upload:

- [ ] Download and backup the keystore file
- [ ] Save all credentials securely
- [ ] Test the app thoroughly
- [ ] Prepare app screenshots (phone + tablet)
- [ ] Prepare feature graphic (1024x500)
- [ ] Write app description
- [ ] Set up content rating questionnaire
- [ ] Configure privacy policy URL

### App Details to Enter:

**Title:** PeopleFlow HR

**Short Description (80 chars):**
Complete HR management for employees, leave, attendance, and payroll

**Full Description:**
PeopleFlow HR is a comprehensive Human Resources management app designed for modern businesses. Manage your entire workforce from one powerful mobile application.

**Features:**
• Employee Directory - Access complete employee profiles with contact information
• Leave Management - Request and approve time off with real-time tracking
• Attendance Tracking - Clock in/out with automatic time calculations
• Payroll Records - View payslips and salary breakdowns with PDF export
• Dashboard Analytics - Real-time HR metrics and insights
• Role-Based Access - Secure access for admins, managers, and employees
• Department Management - Organize teams and track headcount

**Category:** Business
**Content Rating:** Everyone

### Required Graphics:

| Asset | Size | Description |
|-------|------|-------------|
| App Icon | 512x512 | Hi-res icon for store listing |
| Feature Graphic | 1024x500 | Promotional banner |
| Phone Screenshots | 1080x1920 | At least 2-3 screenshots |
| Tablet Screenshots | 1920x1200 | At least 2 screenshots (if tablet supported) |

---

## 🔒 Google Play App Signing

When uploading to Google Play Console:

1. **Enable Google Play App Signing** (recommended)
2. **Upload your keystore** or **let Google manage signing**
3. **Export the upload key** if using app signing

### For App Signing Enrollment:
- Use the keystore file provided
- Google will re-sign with their own key for distribution
- Keep your upload key secure for future updates

---

## 📝 Privacy Policy

You need a privacy policy URL. Create one that covers:
- Data collection (user profiles, attendance data)
- Data storage and security
- User rights
- Contact information

Host it at a URL like: `https://yourcompany.com/privacy-policy`

---

## ⚠️ Important Notes

1. **Never commit the keystore or credentials.json to version control**
2. **Add to .gitignore:**
   ```
   *.keystore
   credentials.json
   google-services.json
   ```

3. **For future updates:**
   - Increment `versionCode` in app.json
   - Update `version` string as needed
   - Build new AAB with same keystore
   
4. **Testing before release:**
   - Use Internal Testing track first
   - Then Closed Testing
   - Finally Production release

---

## 📞 Support

If you need help with the submission process:
1. Check Expo documentation: https://docs.expo.dev/
2. Google Play Console Help: https://support.google.com/googleplay/android-developer
3. EAS Build documentation: https://docs.expo.dev/build/introduction/
