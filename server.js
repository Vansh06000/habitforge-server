require("dotenv").config();
const dns = require("dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);

const express = require("express");const cors = require("cors");
const { MongoClient, ObjectId } = require("mongodb");

const app = express();

app.use(cors());
app.use(express.json());

const mongoURL = process.env.MONGODB_URI;

if (!mongoURL) {
    throw new Error("MONGODB_URI is not defined");
}

const client = new MongoClient(mongoURL);

let database;


async function connectDatabase() {

    try {

        await client.connect();

        database =
            client.db("habitforge");

        console.log(
            "MongoDB connected successfully"
        );

    } catch (error) {

        console.log(
            "MongoDB connection failed:",
            error
        );

    }

}


// ==========================================
// HOME
// ==========================================

app.get("/", (req, res) => {

    res.json({
        message:
            "HabitForge API is running"
    });

});


// ==========================================
// REGISTER
// ==========================================

app.post(
    "/api/auth/register",
    async (req, res) => {

        try {

            const {
                name,
                email,
                password
            } = req.body;


            if (
                !name ||
                !email ||
                !password
            ) {

                return res.status(400).json({
                    message:
                        "Please fill in all required fields."
                });

            }


            if (password.length < 6) {

                return res.status(400).json({
                    message:
                        "Password must contain at least 6 characters."
                });

            }


            const cleanEmail =
                email
                    .trim()
                    .toLowerCase();


            const existingUser =
                await database
                    .collection("users")
                    .findOne({
                        email: cleanEmail
                    });


            if (existingUser) {

                return res.status(409).json({
                    message:
                        "An account with this email already exists."
                });

            }


            const user = {

                name:
                    name.trim(),

                email:
                    cleanEmail,

                password,

                createdAt:
                    new Date()

            };


            const result =
                await database
                    .collection("users")
                    .insertOne(user);


            res.status(201).json({

                message:
                    "Account created successfully.",

                userId:
                    result.insertedId

            });


        } catch (error) {

            console.log(
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


// ==========================================
// LOGIN
// ==========================================

app.post(
    "/api/auth/login",
    async (req, res) => {

        try {

            const {
                email,
                password
            } = req.body;


            if (
                !email ||
                !password
            ) {

                return res.status(400).json({
                    message:
                        "Email and password are required."
                });

            }


            const user =
                await database
                    .collection("users")
                    .findOne({

                        email:
                            email
                                .trim()
                                .toLowerCase(),

                        password

                    });


            if (!user) {

                return res.status(401).json({
                    message:
                        "Invalid email or password."
                });

            }


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

            console.log(
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


// ==========================================
// GET PROFILE
// ==========================================

app.get(
    "/api/profile/:userId",
    async (req, res) => {

        try {

            const userId =
                new ObjectId(
                    req.params.userId
                );


            const user =
                await database
                    .collection("users")
                    .findOne({
                        _id: userId
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

            console.log(
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


// ==========================================
// CHANGE PASSWORD
// ==========================================

app.put(
    "/api/profile/change-password",
    async (req, res) => {

        try {

            const {
                userId,
                currentPassword,
                newPassword
            } = req.body;


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


            if (newPassword.length < 6) {

                return res.status(400).json({
                    message:
                        "New password must contain at least 6 characters."
                });

            }


            const user =
                await database
                    .collection("users")
                    .findOne({
                        _id:
                            new ObjectId(userId)
                    });


            if (!user) {

                return res.status(404).json({
                    message:
                        "User not found."
                });

            }


            if (
                user.password !==
                currentPassword
            ) {

                return res.status(401).json({
                    message:
                        "Current password is incorrect."
                });

            }


            await database
                .collection("users")
                .updateOne(

                    {
                        _id:
                            new ObjectId(userId)
                    },

                    {
                        $set: {
                            password:
                                newPassword
                        }
                    }

                );


            res.json({
                message:
                    "Password changed successfully."
            });


        } catch (error) {

            console.log(
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


// ==========================================
// DELETE ACCOUNT
// ==========================================

app.delete(
    "/api/profile/:userId",
    async (req, res) => {

        try {

            const userId =
                new ObjectId(
                    req.params.userId
                );


            const result =
                await database
                    .collection("users")
                    .deleteOne({
                        _id: userId
                    });


            if (
                result.deletedCount === 0
            ) {

                return res.status(404).json({
                    message:
                        "User not found."
                });

            }


            await database
                .collection("habits")
                .deleteMany({
                    userId:
                        req.params.userId
                });


            await database
                .collection("goals")
                .deleteMany({
                    userId:
                        req.params.userId
                });


            res.json({
                message:
                    "Account deleted successfully."
            });


        } catch (error) {

            console.log(
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


// ==========================================
// ADD HABIT
// ==========================================

app.post(
    "/api/habits",
    async (req, res) => {

        try {

            const {
                userId,
                name,
                category,
                frequency,
                target
            } = req.body;


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


            const habit = {

                userId,

                name:
                    name.trim(),

                category,

                frequency,

                target:
                    Number(target) || 1,

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
                    result.insertedId

            });


        } catch (error) {

            console.log(
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


// ==========================================
// GET HABITS
// ==========================================

app.get(
    "/api/habits",
    async (req, res) => {

        try {

            const userId =
                req.query.userId;


            if (!userId) {

                return res.status(400).json({
                    message:
                        "User ID is required."
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

            console.log(
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


// ==========================================
// EDIT HABIT
// ==========================================

app.put(
    "/api/habits/:id",
    async (req, res) => {

        try {

            const habitId =
                new ObjectId(
                    req.params.id
                );


            const {
                userId,
                name,
                category,
                frequency,
                target
            } = req.body;


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


            const result =
                await database
                    .collection("habits")
                    .updateOne(

                        {
                            _id: habitId,
                            userId
                        },

                        {
                            $set: {

                                name:
                                    name.trim(),

                                category,

                                frequency,

                                target:
                                    Number(target) || 1,

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

            console.log(
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


// ==========================================
// DELETE HABIT
// ==========================================

app.delete(
    "/api/habits/:id",
    async (req, res) => {

        try {

            const habitId =
                new ObjectId(
                    req.params.id
                );

            const userId =
                req.query.userId;


            if (!userId) {

                return res.status(400).json({
                    message:
                        "User ID is required."
                });

            }


            const result =
                await database
                    .collection("habits")
                    .deleteOne({

                        _id:
                            habitId,

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

            console.log(
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


// ==========================================
// COMPLETE HABIT
// ==========================================

app.put(
    "/api/habits/:id/complete",
    async (req, res) => {

        try {

            const habitId =
                new ObjectId(
                    req.params.id
                );

            const {
                userId
            } = req.body;


            if (!userId) {

                return res.status(400).json({
                    message:
                        "User ID is required."
                });

            }


            const habit =
                await database
                    .collection("habits")
                    .findOne({

                        _id:
                            habitId,

                        userId

                    });


            if (!habit) {

                return res.status(404).json({
                    message:
                        "Habit not found."
                });

            }


            const today =
                new Date()
                    .toISOString()
                    .split("T")[0];


            const completedDates =
                habit.completedDates || [];


            const alreadyCompleted =
                completedDates
                    .includes(today);


            if (alreadyCompleted) {

                await database
                    .collection("habits")
                    .updateOne(

                        {
                            _id:
                                habitId,

                            userId
                        },

                        {
                            $pull: {
                                completedDates:
                                    today
                            }
                        }

                    );

            } else {

                await database
                    .collection("habits")
                    .updateOne(

                        {
                            _id:
                                habitId,

                            userId
                        },

                        {
                            $addToSet: {
                                completedDates:
                                    today
                            }
                        }

                    );

            }


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

            console.log(
                "Complete habit error:",
                error
            );

            res.status(500).json({
                message:
                    "Failed to update habit."
            });

        }

    }
);


// ==========================================
// ADD GOAL
// ==========================================

app.post(
    "/api/goals",
    async (req, res) => {

        try {

            const {
                userId,
                title,
                description,
                target
            } = req.body;


            if (
                !userId ||
                !title ||
                !target
            ) {

                return res.status(400).json({
                    message:
                        "Please provide goal title and target."
                });

            }


            const goal = {

                userId,

                title:
                    title.trim(),

                description:
                    description
                    ? description.trim()
                    : "",

                target:
                    Number(target) || 1,

                progress:
                    0,

                completed:
                    false,

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
                    result.insertedId

            });


        } catch (error) {

            console.log(
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


// ==========================================
// GET GOALS
// ==========================================

app.get(
    "/api/goals",
    async (req, res) => {

        try {

            const userId =
                req.query.userId;


            if (!userId) {

                return res.status(400).json({
                    message:
                        "User ID is required."
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

            console.log(
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


// ==========================================
// INCREASE GOAL PROGRESS
// ==========================================

app.put(
    "/api/goals/:id/progress",
    async (req, res) => {

        try {

            const goalId =
                new ObjectId(
                    req.params.id
                );

            const {
                userId
            } = req.body;


            if (!userId) {

                return res.status(400).json({
                    message:
                        "User ID is required."
                });

            }


            const goal =
                await database
                    .collection("goals")
                    .findOne({

                        _id:
                            goalId,

                        userId

                    });


            if (!goal) {

                return res.status(404).json({
                    message:
                        "Goal not found."
                });

            }


            const newProgress =
                Math.min(
                    Number(goal.target),
                    Number(goal.progress || 0) + 1
                );


            await database
                .collection("goals")
                .updateOne(

                    {
                        _id:
                            goalId,

                        userId
                    },

                    {
                        $set: {

                            progress:
                                newProgress,

                            completed:
                                newProgress >=
                                Number(goal.target),

                            updatedAt:
                                new Date()

                        }
                    }

                );


            res.json({

                message:
                    "Goal progress updated.",

                progress:
                    newProgress

            });


        } catch (error) {

            console.log(
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


// ==========================================
// DELETE GOAL
// ==========================================

app.delete(
    "/api/goals/:id",
    async (req, res) => {

        try {

            const goalId =
                new ObjectId(
                    req.params.id
                );

            const userId =
                req.query.userId;


            if (!userId) {

                return res.status(400).json({
                    message:
                        "User ID is required."
                });

            }


            const result =
                await database
                    .collection("goals")
                    .deleteOne({

                        _id:
                            goalId,

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

            console.log(
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


// ==========================================
// START SERVER
// ==========================================

const PORT = process.env.PORT || 5000;

app.listen(PORT, "0.0.0.0", async () => {
    console.log(`HabitForge API running on port ${PORT}`);
    await connectDatabase();
});