# REMS Backend Server

Express.js backend server for Real Estate Management System (REMS) with PostgreSQL and Prisma.

## Prerequisites

- Node.js 18+ 
- PostgreSQL 14+
- npm or yarn

## Setup

1. **Install dependencies:**
   ```bash
   cd server
   npm install
   ```

2. **Set up environment variables:**
   Create a `.env` file in the `server` directory:
   ```env
   DATABASE_URL="postgresql://user:password@localhost:5432/rems_db?schema=public"
   JWT_SECRET="your-super-secret-jwt-key-change-this-in-production"
   JWT_EXPIRES_IN="7d"
   PORT=3001
   NODE_ENV=development
   FRONTEND_URL="http://localhost:3000"
   ```

3. **Set up PostgreSQL database:**
   ```bash
   # Create database
   createdb rems_db
   ```

4. **Run Prisma migrations:**
   ```bash
   npx prisma migrate dev
   ```

5. **Seed the database (optional):**
   ```bash
   npm run prisma:seed
   ```
   
   This will create:
   - Default roles (Admin, HR Manager, Dealer, Tenant, Accountant)
   - Default admin user:
     - Email: `admin@realestate.com`
     - Password: `admin123`

6. **Start the development server:**
   ```bash
   npm run dev
   ```

   The server will run on `http://localhost:3001`

## API Endpoints

### Authentication
- `POST /api/auth/login` - Admin login
- `POST /api/auth/invite-login` - Invite link login
- `GET /api/auth/me` - Get current user

### Roles
- `GET /api/roles` - Get all roles
- `GET /api/roles/:id` - Get role by ID
- `POST /api/roles` - Create role (Admin only)
- `POST /api/roles/generate-invite` - Generate invite link (Admin only)
- `GET /api/roles/:id/invites` - Get invite links for a role (Admin only)

### Device Approval
- `GET /api/device-approval` - Get device approvals (Admin only)
- `GET /api/device-approval/my-approvals` - Get user's device approvals
- `POST /api/device-approval/:id/approve` - Approve device (Admin only)
- `POST /api/device-approval/:id/reject` - Reject device (Admin only)

### Notifications
- `GET /api/notifications` - Get user's notifications
- `PATCH /api/notifications/:id/read` - Mark notification as read
- `PATCH /api/notifications/read-all` - Mark all notifications as read
- `GET /api/notifications/unread-count` - Get unread notification count

## Database Schema

### Models
- **User** - User accounts with roles
- **Role** - User roles with permissions
- **RoleInviteLink** - Invite links for role-based registration
- **DeviceApproval** - Device access approval requests
- **Notification** - User notifications

## Development

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run prisma:studio` - Open Prisma Studio to view database
- `npm run prisma:migrate` - Run database migrations
- `npm run prisma:seed` - Seed the database

## Security Features

- JWT-based authentication
- Password hashing with bcrypt
- Role-based access control (RBAC)
- Device approval system
- Input validation with Zod
- CORS protection

## Notes

- Only Admin users can login directly via `/api/auth/login`
- Other users must use invite links to register/login
- Device approval is required for new devices
- All passwords are hashed before storage

