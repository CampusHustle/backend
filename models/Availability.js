import mongoose from "mongoose";

const availabilitySchema = new mongoose.Schema(
  {
    tutorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    dayOfWeek: {
      type: String,
      enum: [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
      ],
      required: true,
    },

    startTime: {
      type: String,
      required: true,
      match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/,
    },

    endTime: {
      type: String,
      required: true,
      match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/,
    },

    isBooked: {
      type: Boolean,
      default: false,
    },

    imgUrl: {
      type: String,
      required: true,
      default: "https://placehold.co/600x400?text=Image+Not+Found",
    },
  },
  {
    timestamps: true,
  },
);

availabilitySchema.index({
  tutorId: 1,
  dayOfWeek: 1,
  isBooked: 1,
});

export const Availability = mongoose.model("Availability", availabilitySchema);
