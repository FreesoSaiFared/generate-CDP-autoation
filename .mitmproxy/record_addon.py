"""
Multi-level activity recording addon for mitmproxy.

Levels:
1. Network-only: HAR export (for Integuru)
2. Full bodies: Request/response content
3. Timing data: Performance metrics
4. WebSocket: Real-time protocol messages
"""

import json
import logging
import os
import sys
from pathlib import Path
from datetime import datetime
from mitmproxy import http, websocket, ctx
from mitmproxy.addons import save

class LayeredRecorder:
    def __init__(self, record_level=3):
        self.record_level = int(record_level)
        
        # Create session directory with timestamp
        timestamp = datetime.now().isoformat().replace(':', '-')
        self.session_dir = Path(f"./activity_sessions/{timestamp}")
        self.session_dir.mkdir(parents=True, exist_ok=True)
        
        # Initialize data structures
        self.network_log = []
        self.har_data = None
        self.performance_metrics = {}
        self.websocket_messages = []
        self.request_timestamps = {}
        
        # Set up logging
        self.logger = logging.getLogger("LayeredRecorder")
        handler = logging.FileHandler(self.session_dir / "recorder.log")
        formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
        handler.setFormatter(formatter)
        self.logger.addHandler(handler)
        self.logger.setLevel(logging.DEBUG)
        
        self.logger.info(f"LayeredRecorder initialized with level {self.record_level}")
        self.logger.info(f"Session directory: {self.session_dir}")
    
    def load(self, loader):
        """Called when addon is loaded."""
        self.logger.info("LayeredRecorder loaded successfully")
    
    def configure(self, updated):
        """Called when configuration is updated."""
        if "record_level" in updated:
            self.record_level = int(ctx.options.record_level)
            self.logger.info(f"Record level updated to: {self.record_level}")
    
    def requestheaders(self, flow):
        """Level 1+: Log request metadata."""
        timestamp = datetime.now()
        self.request_timestamps[flow.id] = timestamp
        
        request_entry = {
            "timestamp": timestamp.isoformat(),
            "type": "request",
            "method": flow.request.method,
            "url": flow.request.url,
            "headers": dict(flow.request.headers),
            "http_version": flow.request.http_version,
            "flow_id": flow.id
        }
        
        # Level 2+: Include request body
        if self.record_level >= 2 and hasattr(flow.request, 'content') and flow.request.content:
            request_entry["body_size"] = len(flow.request.content)
            try:
                request_entry["body_preview"] = flow.request.text[:500]
            except:
                request_entry["body_preview"] = "[binary data]"
        
        self.network_log.append(request_entry)
        self.logger.debug(f"Request logged: {flow.request.method} {flow.request.url}")
    
    def response(self, flow):
        """Level 1+: Log response metadata."""
        timestamp = datetime.now()
        
        # Calculate timing
        duration_ms = None
        if flow.id in self.request_timestamps:
            duration_ms = (timestamp - self.request_timestamps[flow.id]).total_seconds() * 1000
        
        response_entry = {
            "timestamp": timestamp.isoformat(),
            "type": "response",
            "status_code": flow.response.status_code,
            "headers": dict(flow.response.headers),
            "http_version": flow.response.http_version,
            "duration_ms": duration_ms,
            "url": flow.request.url,
            "flow_id": flow.id
        }
        
        # Level 2+: Include response body
        if self.record_level >= 2 and hasattr(flow.response, 'content') and flow.response.content:
            response_entry["body_size"] = len(flow.response.content)
            try:
                response_entry["body_preview"] = flow.response.text[:500]
            except:
                response_entry["body_preview"] = "[binary data]"
        
        # Level 3+: Full performance metrics
        if self.record_level >= 3:
            self.performance_metrics[flow.request.url] = {
                "status": flow.response.status_code,
                "response_time_ms": duration_ms,
                "content_size_bytes": len(flow.response.content) if flow.response.content else 0,
                "headers_count": len(flow.response.headers),
                "request_method": flow.request.method,
                "timestamp": timestamp.isoformat()
            }
        
        self.network_log.append(response_entry)
        self.logger.debug(f"Response logged: {flow.response.status_code} for {flow.request.url}")
    
    def websocket_message(self, flow):
        """Level 4: Log WebSocket messages."""
        if self.record_level >= 4:
            for message in flow.messages:
                ws_entry = {
                    "timestamp": datetime.now().isoformat(),
                    "type": "websocket",
                    "direction": "client_to_server" if message.from_client else "server_to_client",
                    "message": message.content.decode('utf-8', errors='replace')[:1000],
                    "flow_id": flow.id,
                    "url": flow.request.url
                }
                self.websocket_messages.append(ws_entry)
                self.logger.debug(f"WebSocket message logged: {ws_entry['direction']}")
    
    def websocket_end(self, flow):
        """Called when WebSocket connection ends."""
        if self.record_level >= 4:
            self.logger.info(f"WebSocket connection ended for {flow.request.url}")
    
    def done(self):
        """Save all recorded data on exit."""
        self.logger.info("Saving recorded data...")
        
        try:
            # Save network log
            network_file = self.session_dir / "network_activity.json"
            with open(network_file, "w") as f:
                json.dump(self.network_log, f, indent=2)
            self.logger.info(f"Network activity saved: {network_file}")
            
            # Count requests and responses
            request_count = len([x for x in self.network_log if x['type'] == 'request'])
            response_count = len([x for x in self.network_log if x['type'] == 'response'])
            self.logger.info(f"Total requests: {request_count}, Total responses: {response_count}")
            
            # Save performance metrics
            if self.performance_metrics:
                metrics_file = self.session_dir / "performance_metrics.json"
                with open(metrics_file, "w") as f:
                    json.dump(self.performance_metrics, f, indent=2)
                self.logger.info(f"Performance metrics saved: {metrics_file}")
                self.logger.info(f"Performance entries: {len(self.performance_metrics)}")
            
            # Save WebSocket messages
            if self.websocket_messages:
                ws_file = self.session_dir / "websocket_messages.json"
                with open(ws_file, "w") as f:
                    json.dump(self.websocket_messages, f, indent=2)
                self.logger.info(f"WebSocket messages saved: {ws_file}")
                self.logger.info(f"WebSocket entries: {len(self.websocket_messages)}")
            
            # Create session summary
            summary = {
                "session_id": self.session_dir.name,
                "record_level": self.record_level,
                "start_time": self.network_log[0]["timestamp"] if self.network_log else None,
                "end_time": datetime.now().isoformat(),
                "total_requests": request_count,
                "total_responses": response_count,
                "performance_metrics_count": len(self.performance_metrics),
                "websocket_messages_count": len(self.websocket_messages),
                "files": {
                    "network_activity": str(network_file),
                    "performance_metrics": str(self.session_dir / "performance_metrics.json") if self.performance_metrics else None,
                    "websocket_messages": str(self.session_dir / "websocket_messages.json") if self.websocket_messages else None,
                    "recorder_log": str(self.session_dir / "recorder.log")
                }
            }
            
            summary_file = self.session_dir / "session_summary.json"
            with open(summary_file, "w") as f:
                json.dump(summary, f, indent=2)
            
            self.logger.info(f"Session summary saved: {summary_file}")
            self.logger.info("LayeredRecorder session completed successfully")
            
        except Exception as e:
            self.logger.error(f"Error saving recorded data: {str(e)}")
            raise

# Addon configuration
addons = [LayeredRecorder(record_level=3)]