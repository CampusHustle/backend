import mongoose from 'mongoose';

const availabilitySchema = new mongoose.Schema(
  {
    tutorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Tutor ID is required'],
      index: true,
    },
    dayOfWeek: {
      type: String,
      enum: {
        values: [
          'Monday',
          'Tuesday',
          'Wednesday',
          'Thursday',
          'Friday',
          'Saturday',
          'Sunday',
        ],
        message: '{VALUE} is not a valid day of the week',
      },
      required: [true, 'Day of week is required'],
    },
    startTime: {
      type: String,
      required: [true, 'Start time is required'],
      match: [
        /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/,
        'Start time must be in HH:MM format (24-hour)',
      ],
    },
    endTime: {
      type: String,
      required: [true, 'End time is required'],
      match: [
        /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/,
        'End time must be in HH:MM format (24-hour)',
      ],
      validate: {
        validator: function (v) {
          if (!this.startTime || !v) return true;
          const [startH, startM] = this.startTime.split(':').map(Number);
          const [endH, endM] = v.split(':').map(Number);
          return (endH * 60 + endM) > (startH * 60 + startM);
        },
        message: 'End time must be strictly after start time',
      },
    },
    isBooked: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

availabilitySchema.index({
  tutorId: 1,
  dayOfWeek: 1,
  isBooked: 1,
});

export const Availability = mongoose.model('Availability', availabilitySchema);
export default Availability;
