import 'package:dio/dio.dart';
import 'sync_models.dart';

class SyncClient {
  final Dio _dio;

  SyncClient({Dio? dio, String baseUrl = 'http://localhost:3001/api/v1'})
      : _dio = dio ??
            Dio(
              BaseOptions(
                baseUrl: baseUrl,
                connectTimeout: const Duration(seconds: 15),
                receiveTimeout: const Duration(seconds: 15),
                headers: {
                  'Content-Type': 'application/json',
                  'Accept': 'application/json',
                },
              ),
            );

  Future<SyncPullResponse> pull(
    SyncPullRequest request, {
    String? token,
  }) async {
    final options = token != null
        ? Options(headers: {'Authorization': 'Bearer $token'})
        : null;

    final response = await _dio.post(
      '/sync/pull',
      data: request.toJson(),
      options: options,
    );

    final data = response.data is Map && response.data.containsKey('data')
        ? response.data['data']
        : response.data;

    return SyncPullResponse.fromJson(data as Map<String, dynamic>);
  }

  Future<SyncPushResponse> push(
    Map<String, dynamic> pushPayload, {
    String? token,
    String? traceId,
  }) async {
    final headers = <String, dynamic>{};
    if (token != null) {
      headers['Authorization'] = 'Bearer $token';
    }
    if (traceId != null) {
      headers['x-trace-id'] = traceId;
    }

    final response = await _dio.post(
      '/sync/push',
      data: pushPayload,
      options: Options(headers: headers),
    );

    final data = response.data is Map && response.data.containsKey('data')
        ? response.data['data']
        : response.data;

    return SyncPushResponse.fromJson(data as Map<String, dynamic>);
  }

  Future<Map<String, dynamic>> getStatus(
    String farmId, {
    String? token,
  }) async {
    final options = token != null
        ? Options(headers: {'Authorization': 'Bearer $token'})
        : null;

    final response = await _dio.get(
      '/sync/status/$farmId',
      options: options,
    );

    final data = response.data is Map && response.data.containsKey('data')
        ? response.data['data']
        : response.data;

    return Map<String, dynamic>.from(data as Map);
  }
}
