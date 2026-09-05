import 'package:flutter/material.dart';

void main() {
  runApp(const VetralinkApp());
}

class VetralinkApp extends StatelessWidget {
  const VetralinkApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'VETRALINK PRO',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.teal),
        useMaterial3: true,
      ),
      home: const Scaffold(
        body: Center(
          child: Text(
            'VETRALINK PRO Mobile\nOffline-First Farm ERP & Tele-Vet',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
          ),
        ),
      ),
    );
  }
}
