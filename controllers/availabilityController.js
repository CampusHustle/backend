import Availability from "../models/availability";

//create available slot
export const createAvailability = async (req, res) => {
  try {
    const { tutorId, dayOfWeek, startTime, endTime } = req.body;
    const newSlot = new Availability({
      tutorId,
      dayOfWeek,
      startTime,
      endTime,
    });
    await newSlot.save();
    res.status(201).json({ success: true, data: newSlot });
  } catch (e) {
    res.satus(500).json({ success: false, error: e.message });
  }
};

//get a tutors all available slots

export const getTutorAvailability = async (req, res) => {
  try {
    const { tutorId } = req.params;
    const slots = await Availability.find({ tutorId, isBooked: false });

    res.satus(200).json({ success: true, data: slots });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
};
