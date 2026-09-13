// ============================================================
// HabitForge Backend Server
// ============================================================

require("dotenv").config();

const dns = require("dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);

const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const { MongoClient, ObjectId } = require("mongodb");

const app = express();

// ============================================================
// MIDDLEWARE
// ============================================================

app.use(cors());
app.use(express.json());

// ============================================================
// DATABASE CONFIGURATION
// ============================================================

const mongoURL = process.env.MONGODB_URI;

if (!mongoURL) {
    throw new Error("MONGODB_URI is not defined in .env");
}

const client = new MongoClient(mongoURL);

let database;

// ============================================================
// DATABASE CONNECTION
// ============================================================

async function connectDatabase() {
    try {
        await client.connect();

        database = client.db("habitforge");

        console.log("MongoDB connected successfully");
    } catch (error) {
        console.error("MongoDB connection failed:", error);
        throw error;
    }
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function isValidObjectId(id) {
    return ObjectId.isValid(id);
}

function getObjectId(id) {
    return new ObjectId(id);
}

function cleanText(value) {
    return typeof value === "string"
        ? value.trim()
        : "";
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPassword(password) {
    return (
        typeof password === "string" &&
        password.length >= 6
    );
}

function normalizeNumber(value, fallback = 1) {
    const number = Number(value);

    if (!Number.isFinite(number) || number <= 0) {
        return fallback;
    }

    return number;
}

async function verifyPassword(password, storedPassword) {
    if (
        typeof password !== "string" ||
        typeof storedPassword !== "string"
    ) {
        return false;
    }

    // New secure bcrypt password
    if (storedPassword.startsWith("$2")) {
        return await bcrypt.compare(
            password,
            storedPassword
        );
    }

    // Legacy plaintext password
    return password === storedPassword;
}

// ============================================================
// HOME / API STATUS
// ============================================================

app.get("/", (req, res) => {
    res.json({
        message: "HabitForge API is running",
        status: "online",
        database: database ? "connected" : "connecting"
    });
});

// ============================================================
// REGISTER
// ============================================================

app.post(
    "/api/auth/register",
    async (req, res) => {
        try {
            const name = cleanText(req.body.name);
            const email = cleanText(req.body.email).toLowerCase();
            const password = req.body.password;

            // ----------------------------
            // Validation
            // ----------------------------

            if (!name || !email || !password) {
                return res.status(400).json({
                    message:
                        "Please fill in all required fields."
                });
            }

            if (name.length < 2) {
                return res.status(400).json({
                    message:
                        "Name must contain at least 2 characters."
                });
            }

            if (!isValidEmail(email)) {
                return res.status(400).json({
                    message:
                        "Please enter a valid email address."
                });
            }

            if (!isValidPassword(password)) {
                return res.status(400).json({
                    message:
                        "Password must contain at least 6 characters."
                });
            }

            // ----------------------------
            // Check existing user
            // ----------------------------

            const existingUser =
                await database
                    .collection("users")
                    .findOne({
                        email
                    });

            if (existingUser) {
                return res.status(409).json({
                    message:
                        "An account with this email already exists."
                });
            }

            // ----------------------------
            // Hash password
            // ----------------------------

            const hashedPassword =
                await bcrypt.hash(password, 12);

            // ----------------------------
            // Create user
            // ----------------------------

            const user = {
                name,
                email,
                password: hashedPassword,
                createdAt: new Date()
            };

            const result =
                await database
                    .collection("users")
                    .insertOne(user);

            // ----------------------------
            // Response
            // ----------------------------

            res.status(201).json({
                message:
                    "Account created successfully.",
                userId:
                    result.insertedId.toString()
            });

        } catch (error) {
            console.error(
                "Registration error:",
                error
            );

            res.status(500).json({
                message:
                    "Failed to create account."
            });
        }
    }
);

// ============================================================
// LOGIN
// ============================================================

app.post(
    "/api/auth/login",
    async (req, res) => {
        try {
            const email =
                cleanText(req.body.email).toLowerCase();

            const password =
                req.body.password;

            // ----------------------------
            // Validation
            // ----------------------------

            if (!email || !password) {
                return res.status(400).json({
                    message:
                        "Email and password are required."
                });
            }

            // ----------------------------
            // Find user
            // ----------------------------

            const user =
                await database
                    .collection("users")
                    .findOne({
                        email
                    });

            if (!user) {
                return res.status(401).json({
                    message:
                        "Invalid email or password."
                });
            }

            // ----------------------------
            // Verify password
            // ----------------------------

            const passwordCorrect =
                await verifyPassword(
                    password,
                    user.password
                );

            if (!passwordCorrect) {
                return res.status(401).json({
                    message:
                        "Invalid email or password."
                });
            }

            // ----------------------------
            // Upgrade old plaintext password
            // ----------------------------

            if (
                typeof user.password === "string" &&
                !user.password.startsWith("$2")
            ) {
                const newHash =
                    await bcrypt.hash(
                        password,
                        12
                    );

                await database
                    .collection("users")
                    .updateOne(
                        {
                            _id: user._id
                        },
                        {
                            $set: {
                                password: newHash
                            }
                        }
                    );
            }

            // ----------------------------
            // Login response
            // ----------------------------

            res.json({
                message:
                    "Login successful.",

                user: {
                    id:
                        user._id.toString(),

                    name:
                        user.name,

                    email:
                        user.email
                }
            });

        } catch (error) {
            console.error(
                "Login error:",
                error
            );

            res.status(500).json({
                message:
                    "Failed to login."
            });
        }
    }
);

// ============================================================
// GET PROFILE
// ============================================================

app.get(
    "/api/profile/:userId",
    async (req, res) => {
        try {
            const { userId } = req.params;

            if (!isValidObjectId(userId)) {
                return res.status(400).json({
                    message:
                        "Invalid user ID."
                });
            }

            const user =
                await database
                    .collection("users")
                    .findOne({
                        _id:
                            getObjectId(userId)
                    });

            if (!user) {
                return res.status(404).json({
                    message:
                        "User not found."
                });
            }

            res.json({
                id:
                    user._id.toString(),

                name:
                    user.name,

                email:
                    user.email,

                createdAt:
                    user.createdAt
            });

        } catch (error) {
            console.error(
                "Profile error:",
                error
            );

            res.status(500).json({
                message:
                    "Failed to load profile."
            });
        }
    }
);

// ============================================================
// CHANGE PASSWORD
// ============================================================

app.put(
    "/api/profile/change-password",
    async (req, res) => {
        try {
            const userId =
                cleanText(req.body.userId);

            const currentPassword =
                req.body.currentPassword;

            const newPassword =
                req.body.newPassword;

            // ----------------------------
            // Validation
            // ----------------------------

            if (
                !userId ||
                !currentPassword ||
                !newPassword
            ) {
                return res.status(400).json({
                    message:
                        "Please fill in all password fields."
                });
            }

            if (!isValidObjectId(userId)) {
                return res.status(400).json({
                    message:
                        "Invalid user ID."
                });
            }

            if (!isValidPassword(newPassword)) {
                return res.status(400).json({
                    message:
                        "New password must contain at least 6 characters."
                });
            }

            // ----------------------------
            // Find user
            // ----------------------------

            const user =
                await database
                    .collection("users")
                    .findOne({
                        _id:
                            getObjectId(userId)
                    });

            if (!user) {
                return res.status(404).json({
                    message:
                        "User not found."
                });
            }

            // ----------------------------
            // Verify old password
            // ----------------------------

            const currentPasswordCorrect =
                await verifyPassword(
                    currentPassword,
                    user.password
                );

            if (!currentPasswordCorrect) {
                return res.status(401).json({
                    message:
                        "Current password is incorrect."
                });
            }

            // ----------------------------
            // Hash new password
            // ----------------------------

            const hashedNewPassword =
                await bcrypt.hash(
                    newPassword,
                    12
                );

            // ----------------------------
            // Update password
            // ----------------------------

            await database
                .collection("users")
                .updateOne(
                    {
                        _id:
                            getObjectId(userId)
                    },
                    {
                        $set: {
                            password:
                                hashedNewPassword,
                            updatedAt:
                                new Date()
                        }
                    }
                );

            res.json({
                message:
                    "Password changed successfully."
            });

        } catch (error) {
            console.error(
                "Change password error:",
                error
            );

            res.status(500).json({
                message:
                    "Failed to change password."
            });
        }
    }
);

// ============================================================
// DELETE ACCOUNT
// ============================================================

app.delete(
    "/api/profile/:userId",
    async (req, res) => {
        try {
            const { userId } = req.params;

            if (!isValidObjectId(userId)) {
                return res.status(400).json({
                    message:
                        "Invalid user ID."
                });
            }

            const objectId =
                getObjectId(userId);

            // ----------------------------
            // Delete user
            // ----------------------------

            const result =
                await database
                    .collection("users")
                    .deleteOne({
                        _id: objectId
                    });

            if (result.deletedCount === 0) {
                return res.status(404).json({
                    message:
                        "User not found."
                });
            }

            // ----------------------------
            // Delete user's habits
            // ----------------------------

            await database
                .collection("habits")
                .deleteMany({
                    userId
                });

            // ----------------------------
            // Delete user's goals
            // ----------------------------

            await database
                .collection("goals")
                .deleteMany({
                    userId
                });

            res.json({
                message:
                    "Account deleted successfully."
            });

        } catch (error) {
            console.error(
                "Delete account error:",
                error
            );

            res.status(500).json({
                message:
                    "Failed to delete account."
            });
        }
    }
);

// ============================================================
// ADD HABIT
// ============================================================

app.post(
    "/api/habits",
    async (req, res) => {
        try {
            const userId =
                cleanText(req.body.userId);

            const name =
                cleanText(req.body.name);

            const category =
                cleanText(req.body.category);

            const frequency =
                cleanText(req.body.frequency);

            const unit =
                cleanText(req.body.unit) || "times";

            const target =
                normalizeNumber(
                    req.body.target,
                    1
                );

            // ----------------------------
            // Validation
            // ----------------------------

            if (
                !userId ||
                !name ||
                !category ||
                !frequency
            ) {
                return res.status(400).json({
                    message:
                        "Please provide all habit details."
                });
            }

            if (!isValidObjectId(userId)) {
                return res.status(400).json({
                    message:
                        "Invalid user ID."
                });
            }

            // ----------------------------
            // Create habit
            // ----------------------------

            const habit = {
                userId,

                name,

                category,

                frequency,

                unit,

                target,

                completedDates: [],

                createdAt:
                    new Date()
            };

            const result =
                await database
                    .collection("habits")
                    .insertOne(habit);

            res.status(201).json({
                message:
                    "Habit saved successfully.",

                habitId:
                    result.insertedId.toString()
            });

        } catch (error) {
            console.error(
                "Add habit error:",
                error
            );

            res.status(500).json({
                message:
                    "Failed to save habit."
            });
        }
    }
);

// ============================================================
// GET HABITS
// ============================================================

app.get(
    "/api/habits",
    async (req, res) => {
        try {
            const userId =
                cleanText(req.query.userId);

            if (!userId) {
                return res.status(400).json({
                    message:
                        "User ID is required."
                });
            }

            if (!isValidObjectId(userId)) {
                return res.status(400).json({
                    message:
                        "Invalid user ID."
                });
            }

            const habits =
                await database
                    .collection("habits")
                    .find({
                        userId
                    })
                    .sort({
                        createdAt: -1
                    })
                    .toArray();

            res.json(habits);

        } catch (error) {
            console.error(
                "Get habits error:",
                error
            );

            res.status(500).json({
                message:
                    "Failed to get habits."
            });
        }
    }
);

// ============================================================
// EDIT HABIT
// ============================================================

app.put(
    "/api/habits/:id",
    async (req, res) => {
        try {
            const habitId =
                req.params.id;

            const userId =
                cleanText(req.body.userId);

            const name =
                cleanText(req.body.name);

            const category =
                cleanText(req.body.category);

            const frequency =
                cleanText(req.body.frequency);

            const unit =
                cleanText(req.body.unit) || "times";

            const target =
                normalizeNumber(
                    req.body.target,
                    1
                );

            // ----------------------------
            // Validation
            // ----------------------------

            if (!isValidObjectId(habitId)) {
                return res.status(400).json({
                    message:
                        "Invalid habit ID."
                });
            }

            if (!userId) {
                return res.status(400).json({
                    message:
                        "User ID is required."
                });
            }

            if (!isValidObjectId(userId)) {
                return res.status(400).json({
                    message:
                        "Invalid user ID."
                });
            }

            if (
                !name ||
                !category ||
                !frequency
            ) {
                return res.status(400).json({
                    message:
                        "Please provide all habit details."
                });
            }

            // ----------------------------
            // Update habit
            // ----------------------------

            const result =
                await database
                    .collection("habits")
                    .updateOne(
                        {
                            _id:
                                getObjectId(
                                    habitId
                                ),

                            userId
                        },
                        {
                            $set: {
                                name,
                                category,
                                frequency,
                                unit,
                                target,
                                updatedAt:
                                    new Date()
                            }
                        }
                    );

            if (
                result.matchedCount === 0
            ) {
                return res.status(404).json({
                    message:
                        "Habit not found."
                });
            }

            res.json({
                message:
                    "Habit updated successfully."
            });

        } catch (error) {
            console.error(
                "Edit habit error:",
                error
            );

            res.status(500).json({
                message:
                    "Failed to update habit."
            });
        }
    }
);

// ============================================================
// DELETE HABIT
// ============================================================

app.delete(
    "/api/habits/:id",
    async (req, res) => {
        try {
            const habitId =
                req.params.id;

            const userId =
                cleanText(req.query.userId);

            if (!isValidObjectId(habitId)) {
                return res.status(400).json({
                    message:
                        "Invalid habit ID."
                });
            }

            if (!userId) {
                return res.status(400).json({
                    message:
                        "User ID is required."
                });
            }

            if (!isValidObjectId(userId)) {
                return res.status(400).json({
                    message:
                        "Invalid user ID."
                });
            }

            const result =
                await database
                    .collection("habits")
                    .deleteOne({
                        _id:
                            getObjectId(
                                habitId
                            ),

                        userId
                    });

            if (
                result.deletedCount === 0
            ) {
                return res.status(404).json({
                    message:
                        "Habit not found."
                });
            }

            res.json({
                message:
                    "Habit deleted successfully."
            });

        } catch (error) {
            console.error(
                "Delete habit error:",
                error
            );

            res.status(500).json({
                message:
                    "Failed to delete habit."
            });
        }
    }
);

// ============================================================
// COMPLETE / UNCOMPLETE HABIT
//
// Supports BOTH:
// POST /api/habits/:id/complete
// PUT  /api/habits/:id/complete
//
// This keeps compatibility with the current frontend.
// ============================================================

async function completeHabit(
    req,
    res
) {
    try {
        const habitId =
            req.params.id;

        const userId =
            cleanText(req.body.userId);

        if (!isValidObjectId(habitId)) {
            return res.status(400).json({
                message:
                    "Invalid habit ID."
            });
        }

        if (!userId) {
            return res.status(400).json({
                message:
                    "User ID is required."
            });
        }

        if (!isValidObjectId(userId)) {
            return res.status(400).json({
                message:
                    "Invalid user ID."
            });
        }

        // ----------------------------
        // Find habit
        // ----------------------------

        const habit =
            await database
                .collection("habits")
                .findOne({
                    _id:
                        getObjectId(
                            habitId
                        ),

                    userId
                });

        if (!habit) {
            return res.status(404).json({
                message:
                    "Habit not found."
            });
        }

        // ----------------------------
        // Today's date
        // ----------------------------

        // Prefer the date supplied by the browser so completion follows
        // the user's local calendar. Fall back to India time for compatibility.
        const suppliedDate = cleanText(req.body.date);
        const today = /^\d{4}-\d{2}-\d{2}$/.test(suppliedDate)
            ? suppliedDate
            : new Intl.DateTimeFormat("en-CA", {
                timeZone: "Asia/Kolkata",
                year: "numeric",
                month: "2-digit",
                day: "2-digit"
            }).format(new Date());

        const completedDates =
            Array.isArray(
                habit.completedDates
            )
                ? habit.completedDates
                : [];

        const alreadyCompleted =
            completedDates.includes(
                today
            );

        // ----------------------------
        // Toggle completion
        // ----------------------------

        if (alreadyCompleted) {
            await database
                .collection("habits")
                .updateOne(
                    {
                        _id:
                            getObjectId(
                                habitId
                            ),

                        userId
                    },
                    {
                        $pull: {
                            completedDates:
                                today
                        },

                        $set: {
                            updatedAt:
                                new Date()
                        }
                    }
                );
        } else {
            await database
                .collection("habits")
                .updateOne(
                    {
                        _id:
                            getObjectId(
                                habitId
                            ),

                        userId
                    },
                    {
                        $addToSet: {
                            completedDates:
                                today
                        },

                        $set: {
                            updatedAt:
                                new Date()
                        }
                    }
                );
        }

        // ----------------------------
        // Response
        // ----------------------------

        res.json({
            message:
                alreadyCompleted
                    ? "Habit marked incomplete."
                    : "Habit completed.",

            completed:
                !alreadyCompleted,

            date:
                today
        });

    } catch (error) {
        console.error(
            "Complete habit error:",
            error
        );

        res.status(500).json({
            message:
                "Failed to update habit."
        });
    }
}

// Current frontend compatibility
app.post(
    "/api/habits/:id/complete",
    completeHabit
);

// REST-compatible method
app.put(
    "/api/habits/:id/complete",
    completeHabit
);

// ============================================================
// ADD GOAL
// ============================================================

app.post(
    "/api/goals",
    async (req, res) => {
        try {
            const userId =
                cleanText(req.body.userId);

            const title =
                cleanText(req.body.title);

            const description =
                cleanText(
                    req.body.description
                );

            const target =
                normalizeNumber(
                    req.body.target,
                    1
                );

            // ----------------------------
            // Validation
            // ----------------------------

            if (
                !userId ||
                !title
            ) {
                return res.status(400).json({
                    message:
                        "Please provide goal title and target."
                });
            }

            if (!isValidObjectId(userId)) {
                return res.status(400).json({
                    message:
                        "Invalid user ID."
                });
            }

            // ----------------------------
            // Create goal
            // ----------------------------

            const goal = {
                userId,

                title,

                description,

                target,

                progress: 0,

                completed: false,

                createdAt:
                    new Date()
            };

            const result =
                await database
                    .collection("goals")
                    .insertOne(goal);

            res.status(201).json({
                message:
                    "Goal created successfully.",

                goalId:
                    result.insertedId.toString()
            });

        } catch (error) {
            console.error(
                "Add goal error:",
                error
            );

            res.status(500).json({
                message:
                    "Failed to create goal."
            });
        }
    }
);

// ============================================================
// GET GOALS
// ============================================================

app.get(
    "/api/goals",
    async (req, res) => {
        try {
            const userId =
                cleanText(req.query.userId);

            if (!userId) {
                return res.status(400).json({
                    message:
                        "User ID is required."
                });
            }

            if (!isValidObjectId(userId)) {
                return res.status(400).json({
                    message:
                        "Invalid user ID."
                });
            }

            const goals =
                await database
                    .collection("goals")
                    .find({
                        userId
                    })
                    .sort({
                        createdAt: -1
                    })
                    .toArray();

            res.json(goals);

        } catch (error) {
            console.error(
                "Get goals error:",
                error
            );

            res.status(500).json({
                message:
                    "Failed to get goals."
            });
        }
    }
);

// ============================================================
// INCREASE GOAL PROGRESS
// ============================================================

app.put(
    "/api/goals/:id/progress",
    async (req, res) => {
        try {
            const goalId =
                req.params.id;

            const userId =
                cleanText(req.body.userId);

            if (!isValidObjectId(goalId)) {
                return res.status(400).json({
                    message:
                        "Invalid goal ID."
                });
            }

            if (!userId) {
                return res.status(400).json({
                    message:
                        "User ID is required."
                });
            }

            if (!isValidObjectId(userId)) {
                return res.status(400).json({
                    message:
                        "Invalid user ID."
                });
            }

            // ----------------------------
            // Find goal
            // ----------------------------

            const goal =
                await database
                    .collection("goals")
                    .findOne({
                        _id:
                            getObjectId(
                                goalId
                            ),

                        userId
                    });

            if (!goal) {
                return res.status(404).json({
                    message:
                        "Goal not found."
                });
            }

            // ----------------------------
            // Calculate progress
            // ----------------------------

            const target =
                normalizeNumber(
                    goal.target,
                    1
                );

            const currentProgress =
                Number(
                    goal.progress || 0
                );

            const newProgress =
                Math.min(
                    target,
                    currentProgress + 1
                );

            const completed =
                newProgress >= target;

            // ----------------------------
            // Update goal
            // ----------------------------

            await database
                .collection("goals")
                .updateOne(
                    {
                        _id:
                            getObjectId(
                                goalId
                            ),

                        userId
                    },
                    {
                        $set: {
                            progress:
                                newProgress,

                            completed,

                            updatedAt:
                                new Date()
                        }
                    }
                );

            res.json({
                message:
                    "Goal progress updated.",

                progress:
                    newProgress,

                completed
            });

        } catch (error) {
            console.error(
                "Goal progress error:",
                error
            );

            res.status(500).json({
                message:
                    "Failed to update goal."
            });
        }
    }
);

// ============================================================
// DELETE GOAL
// ============================================================

app.delete(
    "/api/goals/:id",
    async (req, res) => {
        try {
            const goalId =
                req.params.id;

            const userId =
                cleanText(req.query.userId);

            if (!isValidObjectId(goalId)) {
                return res.status(400).json({
                    message:
                        "Invalid goal ID."
                });
            }

            if (!userId) {
                return res.status(400).json({
                    message:
                        "User ID is required."
                });
            }

            if (!isValidObjectId(userId)) {
                return res.status(400).json({
                    message:
                        "Invalid user ID."
                });
            }

            const result =
                await database
                    .collection("goals")
                    .deleteOne({
                        _id:
                            getObjectId(
                                goalId
                            ),

                        userId
                    });

            if (
                result.deletedCount === 0
            ) {
                return res.status(404).json({
                    message:
                        "Goal not found."
                });
            }

            res.json({
                message:
                    "Goal deleted successfully."
            });

        } catch (error) {
            console.error(
                "Delete goal error:",
                error
            );

            res.status(500).json({
                message:
                    "Failed to delete goal."
            });
        }
    }
);

// ============================================================
// GLOBAL ERROR HANDLER
// ============================================================

app.use(
    (error, req, res, next) => {
        console.error(
            "Unhandled server error:",
            error
        );

        res.status(500).json({
            message:
                "An unexpected server error occurred."
        });
    }
);

// ============================================================
// START SERVER
// ============================================================

const PORT =
    process.env.PORT || 5000;

async function startServer() {
    try {
        await connectDatabase();

        app.listen(
            PORT,
            "0.0.0.0",
            () => {
                console.log(
                    `HabitForge API running on port ${PORT}`
                );
            }
        );

    } catch (error) {
        console.error(
            "Server startup failed:",
            error
        );

        process.exit(1);
    }
}

startServer();
