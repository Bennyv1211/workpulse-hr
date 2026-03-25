# PeopleFlow HR

A comprehensive Human Resources Management mobile application built with Expo/React Native and FastAPI.

![PeopleFlow HR](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Platform](https://img.shields.io/badge/platform-iOS%20%7C%20Android%20%7C%20Web-lightgrey.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

## 📱 Features

### Core HR Modules
- **Employee Directory** - Complete employee profiles with search and filters
- **Leave Management** - Request, approve, and track time off
- **Attendance Tracking** - Clock in/out with automatic time calculations
- **Payroll Records** - View payslips with PDF export
- **Dashboard Analytics** - Real-time HR metrics and insights

### Role-Based Access
- Super Admin
- HR Admin
- Manager
- Employee

## 🛠 Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Expo / React Native |
| Backend | FastAPI (Python) |
| Database | MongoDB |
| Auth | JWT |
| Navigation | Expo Router |
| State | Zustand |

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Python 3.11+
- MongoDB
- Expo CLI

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Bennyv1211/peopleflow-hr.git
   cd peopleflow-hr
   ```

2. **Backend Setup**
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```

3. **Configure Environment**
   ```bash
   # Copy and edit backend/.env
   cp backend/.env.example backend/.env
   # Set your MONGO_URL
   ```

4. **Frontend Setup**
   ```bash
   cd frontend
   yarn install
   ```

5. **Run Development**
   ```bash
   # Terminal 1 - Backend
   cd backend
   uvicorn server:app --reload --port 8001

   # Terminal 2 - Frontend
   cd frontend
   npx expo start
   ```

## 📦 Building for Production

### Android (Google Play)

1. **Setup EAS**
   ```bash
   cd frontend
   npx eas-cli login
   npx eas-cli init
   ```

2. **Configure Signing**
   - Copy `credentials.template.json` to `credentials.json`
   - Add your keystore file to `android/app/`
   - Update credentials with your passwords

3. **Build AAB**
   ```bash
   npx eas-cli build --platform android --profile production
   ```

### iOS (App Store)
```bash
npx eas-cli build --platform ios --profile production
```

## 🔐 Security Notes

**Never commit these files:**
- `*.keystore` - Android signing keys
- `credentials.json` - Contains passwords
- `google-services.json` - Firebase config

See `.gitignore` for complete list.

## 📂 Project Structure

```
peopleflow-hr/
├── backend/
│   ├── server.py          # FastAPI application
│   ├── requirements.txt   # Python dependencies
│   └── .env              # Environment variables
├── frontend/
│   ├── app/              # Expo Router screens
│   │   ├── (auth)/       # Auth screens
│   │   ├── (tabs)/       # Main tab screens
│   │   ├── employee/     # Employee details
│   │   ├── leave/        # Leave request
│   │   └── payroll/      # Payroll details
│   ├── src/
│   │   ├── context/      # React contexts
│   │   └── store/        # Zustand store
│   ├── assets/           # Images and fonts
│   ├── app.json          # Expo config
│   └── eas.json          # EAS Build config
└── README.md
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📞 Support

For support, email support@peopleflow.hr or open an issue.

---

Built with ❤️ using Expo and FastAPI
"# workpulse-hr" 
"# workpulse-hr" 
