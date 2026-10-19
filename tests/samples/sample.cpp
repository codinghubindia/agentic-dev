#include <iostream>
#include <string>

#define MAX_BUFFER 4096

namespace core {

struct PacketHeader {
    int id;
    int length;
};

class ConnectionManager {
public:
    ConnectionManager();
    ~ConnectionManager();
    bool connect(const std::string& host, int port) {
        // connect logic
        return true;
    }
    void disconnect() {
        // disconnect logic
    }
};

int send_data(const char* buffer, size_t size) {
    return static_cast<int>(size);
}

} // namespace core
