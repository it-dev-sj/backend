const Challenge = require('../models/challenge.model');

class ChallengeController {
  // Create new challenge
  async create(req, res) {
    try {
      const { name, description, instructor, areas, media, steps, recurring, moduleID } = req.body;

      const challenge = await Challenge.create({
        name,
        description,
        instructor,
        areas,
        media,
        steps,
        recurring,
        moduleID
      });

      res.status(200).json({
        status: 'success',
        data: {
          challenge
        }
      });
    } catch (error) {
      res.status(400).json({
        status: 'error',
        message: error.message
      });
    }
  }

  // Get all challenges
  async getAll(req, res) {
    try {
      const challenges = await Challenge.find().sort({ createdAt: -1 });
      res.status(200).json({
        status: 'success',
        data: {
          challenges
        }
      });
    } catch (error) {
      res.status(400).json({
        status: 'error',
        message: error.message
      });
    }
  }

  // Get challenge by ID
  async getById(req, res) {
    try {
      const challenge = await Challenge.findById(req.params.id);
      if (!challenge) {
        return res.status(404).json({
          status: 'error',
          message: 'Challenge not found'
        });
      }
      res.status(200).json({
        status: 'success',
        data: {
          challenge
        }
      });
    } catch (error) {
      res.status(400).json({
        status: 'error',
        message: error.message
      });
    }
  }
}

module.exports = new ChallengeController(); 