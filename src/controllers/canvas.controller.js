const axios = require('axios');
const FormData = require('form-data');
const courseId = process.env.CANVAS_COURSE_ID;
const apiToken = process.env.CANVAS_API_TOKEN;
const canvasApiUrl = process.env.CANVAS_API_URL;

class CanvasController {
  async getModules(req, res) {
    try {

      if (!courseId || !apiToken || !canvasApiUrl) {
        return res.status(500).json({
          status: 'error',
          message: 'Canvas configuration is missing'
        });
      }

      const response = await axios.get(
        `${canvasApiUrl}/api/v1/courses/${courseId}/modules`,
        {
          headers: {
            'Authorization': `Bearer ${apiToken}`
          }
        }
      );

      res.status(200).json({
        status: 'success',
        data: response.data
      });
    } catch (error) {
      console.error('Canvas API Error:', error.response?.data || error.message);
      res.status(error.response?.status || 500).json({
        status: 'error',
        message: error.response?.data?.message || 'Failed to fetch Canvas modules'
      });
    }
  }

  async getFile(req, res) {
    try {
      const { id } = req.params;

      if (!courseId || !apiToken || !canvasApiUrl) {
        console.error('Canvas configuration missing:', { courseId, apiToken: !!apiToken, canvasApiUrl });
        return res.status(500).json({
          status: 'error',
          message: 'Canvas configuration is missing'
        });
      }

      const response = await axios.get(
        `${canvasApiUrl}/api/v1/courses/${courseId}/files/${id}`,
        {
          headers: {
            'Authorization': `Bearer ${apiToken}`
          }
        }
      );

      if (!response.data || !response.data.url) {
        throw new Error('Invalid response from Canvas API');
      }

      res.status(200).json({
        status: 'success',
        data: {
          url: response.data.url,
          mime_class: response.data.mime_class
        }
      });
    } catch (error) {
      console.error('Canvas API Error:', error.response?.data || error.message);
      res.status(error.response?.status || 500).json({
        status: 'error',
        message: error.response?.data?.message || 'Failed to fetch file from Canvas'
      });
    }
  }

  async removeFile(req, res) {
    try {
      const { id } = req.params;

      if (!courseId || !apiToken || !canvasApiUrl) {
        return res.status(500).json({
          status: 'error',
          message: 'Canvas configuration is missing'
        });
      }

      const response = await axios.delete(
        `${canvasApiUrl}/api/v1/courses/${courseId}/files/${id}`,
        {
          headers: {
            'Authorization': `Bearer ${apiToken}`
          }
        }
      );

      res.status(200).json({
        status: 'success',
        data: {
          url: response.data.url
        }
      });
    } catch (error) {
      console.error('Canvas API Error:', error.response?.data || error.message);
      res.status(error.response?.status || 500).json({
        status: 'error',
        message: error.response?.data?.message || 'Failed to fetch file from Canvas'
      });
    }
  }

  async addModule(req, res) {
    try {
      const { name, unlock_at } = req.body;

      if (!courseId || !apiToken || !canvasApiUrl) {
        return res.status(500).json({
          status: 'error',
          message: 'Canvas configuration is missing'
        });
      }

      if (!name) {
        return res.status(400).json({
          status: 'error',
          message: 'Module name is required'
        });
      }

      const response = await axios.post(
        `${canvasApiUrl}/api/v1/courses/${courseId}/modules`,
        {
          module: {
            name,
            unlock_at
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${apiToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      res.status(201).json({
        status: 'success',
        data: response.data
      });
    } catch (error) {
      console.error('Canvas API Error:', error.response?.data || error.message);
      res.status(error.response?.status || 500).json({
        status: 'error',
        message: error.response?.data?.message || 'Failed to create Canvas module'
      });
    }
  }

  async fileUploadSession(req, res) {
    try {
      const { size, parent_folder_path} = req.body;

      if (!courseId || !apiToken || !canvasApiUrl) {
        return res.status(500).json({
          status: 'error',
          message: 'Canvas configuration is missing'
        });
      }

      if (!size) {
        return res.status(400).json({
          status: 'error',
          message: 'File size is required'
        });
      }

      const response = await axios.post(
        `${canvasApiUrl}/api/v1/courses/${courseId}/files`,
        {
          size,
          parent_folder_path,
        },
        {
          headers: {
            'Authorization': `Bearer ${apiToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      res.status(201).json({
        status: 'success',
        data: response.data
      });
    } catch (error) {
      console.error('Canvas API Error:', error.response?.data || error.message);
      res.status(error.response?.status || 500).json({
        status: 'error',
        message: error.response?.data?.message || 'Failed to create Canvas module'
      });
    }
  }

  async fileUpload(req, res) {
    try {
      const { filename, file, upload_url, content_type } = req.body;

      if (!courseId || !apiToken || !canvasApiUrl) {
        return res.status(500).json({
          status: 'error',
          message: 'Canvas configuration is missing'
        });
      }

      if (!filename || !file) {
        return res.status(400).json({
          status: 'error',
          message: 'File name and file data are required'
        });
      }

      // Create form data for the file upload
      const formData = new FormData();
      formData.append('file', Buffer.from(file), {
        filename: filename,
        contentType: content_type
      });

      // Forward the file directly to Canvas API
      const response = await axios.post(
        upload_url,
        formData,
        {
          headers: {
            'Authorization': `Bearer ${apiToken}`,
            ...formData.getHeaders()
          }
        }
      );

      res.status(201).json({
        status: 'success',
        data: response.data
      });
    } catch (error) {
      console.error('Canvas API Error:', error.response?.data || error.message);
      res.status(error.response?.status || 500).json({
        status: 'error',
        message: error.response?.data?.message || 'Failed to upload file'
      });
    }
  }

  async addModuleItem(req, res) {
    try {
      const { title, content_id, type, module_id} = req.body;

      if (!courseId || !apiToken || !canvasApiUrl) {
        return res.status(500).json({
          status: 'error',
          message: 'Canvas configuration is missing'
        });
      }

      if (!title) {
        return res.status(400).json({
          status: 'error',
          message: 'Module Item title is required'
        });
      }

      const response = await axios.post(
        `${canvasApiUrl}/api/v1/courses/${courseId}/modules/${module_id}/items`,
        {
          module_item: {
            title,
            content_id,
            type,
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${apiToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      res.status(201).json({
        status: 'success',
        data: response.data
      });
    } catch (error) {
      console.error('Canvas API Error:', error.response?.data || error.message);
      res.status(error.response?.status || 500).json({
        status: 'error',
        message: error.response?.data?.message || 'Failed to create Canvas Module Item'
      });
    }
  }
}

module.exports = new CanvasController(); 